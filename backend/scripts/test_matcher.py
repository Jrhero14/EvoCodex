import asyncio
from pathlib import Path
from cocoindex.resources.file import PatternFilePathMatcher, FilePath

async def test_matcher():
    matcher = PatternFilePathMatcher(
        included_patterns=["**/*.md"],
        excluded_patterns=["api-spec-enum.md", "**/node_modules"]
    )
    
    # Simulate paths
    paths_to_test = [
        "README.md",
        "api-spec-enum.md",
        "docs/api-spec-enum.md",
        "src/api-spec-enum.md",
        "node_modules/test.md"
    ]
    
    print("Testing PatternFilePathMatcher:")
    for p in paths_to_test:
        path_obj = FilePath(base_dir=Path("."), path=Path(p))
        result = await matcher.match(path_obj)
        print(f"{p}: {result}")

if __name__ == "__main__":
    asyncio.run(test_matcher())
