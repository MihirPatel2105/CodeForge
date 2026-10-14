export const prefix = "/preview/redesign";
export const href = (screen = "home") => `${prefix}${screen === "home" ? "" : `/${screen}`}`;

export const screenGroups: readonly { label: string; screens: readonly (readonly [string, string])[] }[] = [
  { label: "Public site", screens: [["home", "Homepage"], ["how-it-works", "How it works"], ["about", "About"], ["faq", "FAQ"], ["contact", "Contact"], ["privacy", "Privacy"], ["terms", "Terms"]] },
  { label: "Workspace", screens: [["projects", "Projects"], ["project", "Project detail"], ["run", "Completed run"], ["run/live", "Live run"], ["try", "API tester"], ["use", "Integration kit"], ["publish", "Publish API"]] },
  { label: "Account", screens: [["profile", "Profile"], ["settings", "Settings"], ["settings/password", "Password"], ["settings/2fa", "Two-factor authentication"], ["settings/passkeys", "Passkeys"], ["login", "Sign in"], ["signup", "Create account"], ["forgot-password", "Password recovery"], ["verify", "Verification"], ["passkey", "Passkey sign-in"]] },
  { label: "Administration", screens: [["admin", "Overview"], ["admin/users", "Users"], ["admin/runs", "Runs"], ["admin/deployments", "Deployments"], ["admin/monitoring", "Monitoring"], ["admin/quality", "Quality"], ["admin/incidents", "Incidents"], ["admin/audit", "Audit log"], ["admin/system", "System health"]] },
] as const;

export type PreviewProject = { name: string; description: string; runs: number; endpoints: number; updated: string; status: "Ready" | "Draft" | "Needs review"; icon: "library" | "inventory" | "support" | "events" };
export const initialProjects: PreviewProject[] = [
  { name: "Personal Library", description: "A home for books, authors and everything on your reading list.", runs: 8, endpoints: 6, updated: "12 minutes ago", status: "Ready", icon: "library" },
  { name: "Inventory Service", description: "Stock levels, product records and a little less spreadsheet work.", runs: 4, endpoints: 8, updated: "2 hours ago", status: "Ready", icon: "inventory" },
  { name: "Support Desk", description: "Tickets, priorities and the conversations that keep customers happy.", runs: 3, endpoints: 5, updated: "Yesterday", status: "Needs review", icon: "support" },
  { name: "Community Events", description: "A simple starting point for events and registrations.", runs: 0, endpoints: 0, updated: "Yesterday", status: "Draft", icon: "events" },
];
export const stages = [
  { name: "PM", title: "Define", detail: "Requirements & scope", time: "8s" },
  { name: "Architect", title: "Design", detail: "Routes & data models", time: "14s" },
  { name: "Coder", title: "Build", detail: "Application & tests", time: "38s" },
  { name: "Reviewer", title: "Review", detail: "Find issues & refine", time: "12s" },
  { name: "Tester", title: "Verify", detail: "Execute the test suite", time: "18s" },
  { name: "Sandbox", title: "Run", detail: "Isolated execution", time: "9s" },
];
export const fileContents: Record<string, string> = {
  "main.py": `from contextlib import asynccontextmanager\nfrom fastapi import FastAPI, HTTPException\nfrom models import Book\nfrom schemas import BookCreate, BookResponse\nfrom database import connect, disconnect\n\n\n@asynccontextmanager\nasync def lifespan(app: FastAPI):\n    await connect()\n    yield\n    await disconnect()\n\n\napp = FastAPI(title="Personal Library", lifespan=lifespan)\n\n\n@app.get("/books", response_model=list[BookResponse])\nasync def list_books():\n    books = await Book.find_all().to_list()\n    return [BookResponse.from_document(book) for book in books]\n\n\n@app.post("/books", status_code=201, response_model=BookResponse)\nasync def create_book(payload: BookCreate):\n    book = Book(**payload.model_dump())\n    await book.insert()\n    return BookResponse.from_document(book)\n\n\n@app.get("/books/{book_id}", response_model=BookResponse)\nasync def get_book(book_id: str):\n    book = await Book.get(book_id)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    return BookResponse.from_document(book)\n\n\n@app.delete("/books/{book_id}", status_code=204)\nasync def delete_book(book_id: str):\n    book = await Book.get(book_id)\n    if book is None:\n        raise HTTPException(status_code=404, detail="Book not found")\n    await book.delete()`,
  "models.py": `from beanie import Document\n\n\nclass Book(Document):\n    title: str\n    author: str\n    read: bool = False\n\n    class Settings:\n        name = "books"`,
  "schemas.py": `from pydantic import BaseModel, Field\n\n\nclass BookCreate(BaseModel):\n    title: str = Field(min_length=1, max_length=200)\n    author: str = Field(min_length=1, max_length=160)\n    read: bool = False\n\n\nclass BookResponse(BookCreate):\n    id: str\n\n    @classmethod\n    def from_document(cls, book):\n        return cls(**book.model_dump(exclude={"id"}), id=str(book.id))`,
  "database.py": `from motor.motor_asyncio import AsyncIOMotorClient\nfrom beanie import init_beanie\nfrom models import Book\n\nclient = None\n\n\nasync def connect():\n    global client\n    client = AsyncIOMotorClient("mongodb://localhost:27017")\n    await init_beanie(database=client.library, document_models=[Book])\n\n\nasync def disconnect():\n    if client is not None:\n        client.close()`,
  "test_main.py": `import pytest\nfrom fastapi.testclient import TestClient\nfrom main import app\n\n\n@pytest.fixture\ndef client():\n    with TestClient(app) as test_client:\n        yield test_client\n\n\ndef test_create_book(client):\n    response = client.post("/books", json={\n        "title": "The Pragmatic Programmer",\n        "author": "Andrew Hunt & David Thomas"\n    })\n    assert response.status_code == 201\n    assert response.json()["title"] == "The Pragmatic Programmer"\n\n\ndef test_list_books(client):\n    response = client.get("/books")\n    assert response.status_code == 200\n    assert isinstance(response.json(), list)\n\n\ndef test_empty_title_is_rejected(client):\n    response = client.post("/books", json={"title": "", "author": "Author"})\n    assert response.status_code == 422\n\n\ndef test_missing_book(client):\n    response = client.get("/books/000000000000000000000000")\n    assert response.status_code == 404\n\n\ndef test_delete_missing_book(client):\n    response = client.delete("/books/000000000000000000000000")\n    assert response.status_code == 404`,
};
export const events = [
  { agent: "PM", title: "A clear starting point", detail: "Defined book records, reading status and CRUD behavior.", time: "00:08", type: "info" },
  { agent: "Architect", title: "The blueprint is ready", detail: "Designed six routes and three data models.", time: "00:22", type: "info" },
  { agent: "Coder", title: "First implementation written", detail: "Generated five files and an executable test suite.", time: "01:00", type: "info" },
  { agent: "Reviewer", title: "One issue needs attention", detail: "An empty book title should be rejected. Sent back to Coder.", time: "01:12", type: "repair" },
  { agent: "Coder", title: "Validation tightened", detail: "Added a minimum title length and a regression test.", time: "01:25", type: "repair" },
  { agent: "Tester", title: "All seven tests passed", detail: "Checked creation, listing, validation and missing records.", time: "01:43", type: "info" },
  { agent: "Sandbox", title: "Ready to explore", detail: "Application started successfully in an isolated container.", time: "01:52", type: "info" },
];
export const exampleBooks = [{ id: "book_01", title: "The Pragmatic Programmer", author: "Andrew Hunt & David Thomas", read: true }, { id: "book_02", title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", read: false }];
export const faqs = [
  { question: "What can I build with CodeForge?", answer: "Small CRUD APIs with routes, data models and tests. Start with a focused use case such as a personal library, inventory service or support desk." },
  { question: "What happens when a test fails?", answer: "The evidence returns to the Coder. The Reviewer checks the repair and the test suite runs again, within the run’s iteration limits." },
  { question: "Can I inspect the generated code?", answer: "Yes. Generated files, reviewer findings and test output stay together in the run workspace. You can download the result and continue in your own editor." },
  { question: "Is this preview connected to my account?", answer: "No. This design preview uses fictional projects and local interactions. It does not generate, publish or delete real APIs." },
];
