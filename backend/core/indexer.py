"""
Real-time codebase indexing with CocoIndex (v1).

Pipeline: walk a codebase -> detect language -> Tree-sitter chunk -> embed ->
upsert into Postgres (pgvector). With `live=True`, the source keeps watching
the filesystem so the index stays fresh as you edit.

Build / update the index:
    cocoindex update main        # catch-up: scan, sync changes, exit
    cocoindex update -L main     # live: catch up, then keep watching for edits

Query the index:
    python main.py "your query"  # one-shot
    python main.py               # interactive loop

By default it indexes this repository. Point it elsewhere with:
    export COCOINDEX_SOURCE_PATH=/path/to/your/repo
"""

from __future__ import annotations

import asyncio
import os
import pathlib
import sys
from dataclasses import dataclass
from typing import Annotated, AsyncIterator

import asyncpg
from dotenv import load_dotenv

load_dotenv()
from numpy.typing import NDArray
from pgvector.asyncpg import register_vector

import cocoindex as coco
from cocoindex.connectors import localfs, postgres
# from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder
from cocoindex.ops.text import RecursiveSplitter, detect_code_language
from cocoindex.resources.chunk import Chunk
from cocoindex.resources.file import FileLike, PatternFilePathMatcher
from cocoindex.resources.id import UuidGenerator

from backend.core.config import DATABASE_URL, SOURCE_PATH, PROJECT_NAME, BRANCH_NAME, TABLE_NAME, EMBED_MODEL, EMBEDDING_PROVIDER, LOCAL_EMBED_MODEL
from cocoindex.ops.litellm import LiteLLMEmbedder
from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder
from typing import Any

PG_DB = coco.ContextKey[asyncpg.Pool]("code_embedding_db")
EMBEDDER = coco.ContextKey[Any]("embedder", detect_change=True)

_splitter = RecursiveSplitter()


@dataclass
class CodeEmbedding:
    id: str
    project_name: str
    branch: str
    filename: str
    code: str
    embedding: Annotated[NDArray, EMBEDDER]
    start_line: int
    end_line: int


# @coco.lifespan
# async def coco_lifespan(builder: coco.EnvironmentBuilder) -> AsyncIterator[None]:
#     async with asyncpg.create_pool(DATABASE_URL) as pool:
#         builder.provide(PG_DB, pool)
#         builder.provide(EMBEDDER, SentenceTransformerEmbedder(EMBED_MODEL))
#         yield

@coco.lifespan
async def coco_lifespan(builder: coco.EnvironmentBuilder) -> AsyncIterator[None]:
    async with asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5) as pool:
        builder.provide(PG_DB, pool)
        
        if EMBEDDING_PROVIDER == "local":
            builder.provide(EMBEDDER, SentenceTransformerEmbedder(LOCAL_EMBED_MODEL, trust_remote_code=True))
        else:
            builder.provide(EMBEDDER, LiteLLMEmbedder(EMBED_MODEL))
        yield

@coco.fn
async def process_chunk(
    chunk: Chunk,
    filename: str,
    id_gen: UuidGenerator,
    table: postgres.TableTarget[CodeEmbedding],
    project_name: str,
    branch_name: str,
) -> None:
    embedding = await coco.use_context(EMBEDDER).embed(chunk.text)
    table.declare_row(
        row=CodeEmbedding(
            id=str(id_gen.next_uuid(f"{project_name}:{branch_name}:{chunk.text}")),
            project_name=project_name,
            branch=branch_name,
            filename=filename,
            code=chunk.text,
            embedding=embedding,
            start_line=chunk.start.line,
            end_line=chunk.end.line,
        ),
    )


@coco.fn(memo=True)
async def process_file(
    file: FileLike,
    table: postgres.TableTarget[CodeEmbedding],
    project_name: str,
    branch_name: str,
    sourcedir: pathlib.Path,
) -> None:
    text = await file.read_text()
    language = detect_code_language(filename=str(file.file_path.path.name))
    chunks = _splitter.split(
        text,
        chunk_size=600,
        min_chunk_size=150,
        chunk_overlap=150,
        language=language,
    )
    
    rel_path = file.file_path.path.relative_to(sourcedir)
    formatted_project = project_name.lower().replace(" ", "-")
    display_filename = f"{formatted_project}/{rel_path}"
    
    id_gen = UuidGenerator()
    await coco.map(process_chunk, chunks, display_filename, id_gen, table, project_name, branch_name)


@coco.fn
async def app_main(sourcedir: pathlib.Path, project_name: str, branch_name: str) -> None:
    target_table = await postgres.mount_table_target(
        PG_DB,
        table_name=TABLE_NAME,
        table_schema=await postgres.TableSchema.from_class(
            CodeEmbedding,
            primary_key=["id"],
        ),
        managed_by="user",
    )
    target_table.declare_vector_index(column="embedding")

    included_patterns_str = os.getenv("COCOINDEX_INCLUDED_PATTERNS", "**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.sass,**/*.html")
    excluded_patterns_str = os.getenv("COCOINDEX_EXCLUDED_PATTERNS", "**/.*,**/*.md,**/target,**/node_modules,**/scripts,**/internal,**/tests")
    
    included_patterns = [p.strip() for p in included_patterns_str.split(",") if p.strip()]
    excluded_patterns = [p.strip() for p in excluded_patterns_str.split(",") if p.strip()]

    files = localfs.walk_dir(
        sourcedir,
        recursive=True,
        path_matcher=PatternFilePathMatcher(
            included_patterns=included_patterns,
            excluded_patterns=excluded_patterns,
        ),
        live=True,  # source watches the filesystem; pass -L to actually run live
    )
    await coco.mount_each(process_file, files.items(), target_table, project_name, branch_name, sourcedir)


app = coco.App(
    # Escape invalid characters for AppConfig name like / in branches
    coco.AppConfig(name=f"CodeEmbedding_{PROJECT_NAME}_{BRANCH_NAME.replace('/', '_')}"),
    app_main,
    sourcedir=SOURCE_PATH,
    project_name=PROJECT_NAME,
    branch_name=BRANCH_NAME,
)

