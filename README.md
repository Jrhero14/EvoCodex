# Evocodex

**Evocodex** is a real-time code indexing and semantic search platform designed to help developers and teams search through large codebases using natural language. It automatically syncs with your Git repositories (e.g., GitLab) via webhooks, embeds your code using AI models (Vertex AI or local embeddings), and stores the vector data in PostgreSQL with `pgvector` for lightning-fast semantic queries.

![Evocodex Landing Page](docs/landing-page-example.png)

## ✨ Features

- **Real-Time Indexing**: Listens to Git webhooks (Push events) and automatically triggers background jobs to clone the latest code, parse it, and generate embeddings.
- **Semantic Search Engine**: Search your codebase using natural language. No more struggling with exact keyword matches.
- **Dynamic User Interface**: Built with React and Vite, featuring a sleek, modern UI with abstract animations (Wave Mesh) and intuitive dashboards.
- **OAuth SSO & Internal Auth**: Secure your platform using builtin JWT authentication or connect to an external OAuth provider (e.g., Keycloak).
- **In-App Settings Management**: Modify environment variables, AI credentials, and webhook secrets directly from a secure admin UI dashboard without needing to restart the server.
- **Role-Based Access Control (RBAC)**: Manage users with distinct roles (`admin`, `maintener`, `guest`) to restrict access to settings, user management, and webhook logs.
- **Monitoring & History**: Real-time webhook logs and a comprehensive build history dashboard to track indexing jobs and their outcomes.

## 🏗️ Architecture

- **Backend**: Python, FastAPI, Asyncpg, Pydantic
- **Frontend**: React.js, Vite, Tailwind CSS, Lucide React
- **Database**: PostgreSQL (with `pgvector` extension)
- **AI/Embedding**: `cocoindex` CLI integration (supporting Google Vertex AI and Local HuggingFace models)

---

## 🚀 Getting Started (Docker / Production)

The easiest way to run Evocodex in a production or isolated environment is using Docker Compose.

### 1. Prerequisites
- Docker and Docker Compose installed on your machine.

### 2. Configuration
Copy the sample environment file to create your own configuration:
```bash
cp .env.example .env
```
*(See the **Environment Variables** section below for details on what to configure).*

### 3. Run the Services
Run the following command to build the images and start the containers in the background:
```bash
docker-compose up -d --build
```
This will spin up:
- **db**: PostgreSQL database with `pgvector` enabled (Port `5432`).
- **app**: The combined backend API and static frontend server (Port `8000`).

You can now access the application at `http://localhost:8000`.

---

## 🛠️ Local Development Setup

If you wish to contribute to the code or run it locally without Docker, follow these steps.

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 15+ with the `pgvector` extension installed.

### 1. Database Setup
Create a PostgreSQL database and enable the `pgvector` extension:
```sql
CREATE DATABASE evocodex;
\c evocodex
CREATE EXTENSION vector;
```

### 2. Backend Setup
Navigate to the project root and create a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Run database migrations to seed the initial tables and default roles:
```bash
python -m backend.scripts.run_migrations
```

Start the FastAPI development server:
```bash
uvicorn backend.api.app:app --host 0.0.0.0 --port 8080 --reload
```
The API documentation (Swagger) will be available at `http://localhost:8080/api/docs`.

### 3. Frontend Setup
Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will start, typically accessible at `http://localhost:5173`.

---

## ⚙️ Environment Variables (`.env`)

Here are the key environment variables you need to configure. Note that many of these can also be edited later directly via the **Settings Dashboard** in the app.

```ini
# Application & Database
POSTGRES_URL=postgresql://evocodex:codexevo12345@localhost:5432/evocodex
SERVER_PORT=8000

# OAuth Config
ENABLE_OAUTH=true
OAUTH_PROVIDER=keycloak
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_WELL_KNOWN_URL=https://your-auth-server.com/realms/realm-name/.well-known/openid-configuration

# AI & Embedding Providers
COCOINDEX_EMBEDDING_PROVIDER=vertex  # Options: 'vertex' or 'local'
VERTEX_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
# HF_TOKEN=your-huggingface-token # Only required if using local private models

# GitLab Configurations
GITLAB_PAT=your-gitlab-personal-access-token
GITLAB_WEBHOOK_SECRET=your-webhook-secret-string
```

---

## 💡 How to Use

1. **Login**: Access the web UI. Login using the default internal credentials or via SSO if enabled.
2. **Settings**: Navigate to the Settings tab to ensure your GitLab PAT, Webhook Secrets, and AI Provider credentials are correct.
3. **Register Webhook**: 
   - Go to your GitLab repository -> Settings -> Webhooks.
   - Add your Evocodex webhook URL: `https://your-domain.com/api/gitlab_webhook`
   - Paste the Webhook Secret matching your configuration.
   - Set the trigger for **Push events**.
   - *(Optional)* Pass `?templateCode=framework-name` in the URL if you want specific codebase templates handled.
4. **Monitor Indexing**: Push some code to your repository. Navigate to the **Monitoring** tab in Evocodex to watch the background indexing job run in real-time.
5. **Search**: Once the job succeeds, navigate to the **Query** tab and start asking questions about your codebase in natural language!

---

## 🔒 User Roles
- **admin**: Full access to all menus, settings, and destructive operations.
- **maintener**: Can create, edit, and delete records, but does not have access to the global Settings page.
- **guest**: View-only access to Query, Database, and Projects. Cannot trigger manual indexing or delete data.
