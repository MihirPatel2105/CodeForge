import type { CodeForgeEvent } from "./types";

export interface DemoPreview {
  id: string;
  file: string;
  result: string;
  lines: string[];
}

export interface DemoRunDefinition {
  slug: string;
  label: string;
  title: string;
  prompt: string;
  preview: DemoPreview;
  initialFiles: Record<string, string>;
  finalFiles: Record<string, string>;
  testFile: { path: string; content: string };
  tests: number;
}

export type DemoRun = DemoRunDefinition & { events: CodeForgeEvent[] };

const BASE_TIME = Date.parse("2026-01-15T10:00:00.000Z");

function eventAt(seconds: number, data: Record<string, unknown>): CodeForgeEvent {
  return {
    at: new Date(BASE_TIME + seconds * 1000).toISOString(),
    ...data,
  } as CodeForgeEvent;
}

function buildEvents(demo: DemoRunDefinition): CodeForgeEvent[] {
  const events: CodeForgeEvent[] = [
    eventAt(0, { event: "run.started", run_id: `demo-${demo.slug}`, prompt: demo.prompt }),
    eventAt(1, { event: "agent.started", agent: "pm", iteration: 0 }),
    eventAt(3, {
      event: "agent.message",
      agent: "pm",
      text: `Defined the ${demo.label.toLowerCase()} API requirements and CRUD operations.`,
    }),
    eventAt(5, {
      event: "agent.completed",
      agent: "pm",
      output_summary: { entities: 1, operations: 4, model: "demo/replay" },
      duration_ms: 4120,
    }),
    eventAt(6, {
      event: "approval.required",
      phase: "pm",
      payload: {
        project_name: demo.title,
        entity: demo.label === "Library" ? "Book" : demo.label === "Inventory" ? "Product" : "Ticket",
        operations: "create, read, update, delete",
      },
    }),
    eventAt(8, { event: "approval.resolved", phase: "pm", approved: true, note: null }),
    eventAt(9, { event: "agent.started", agent: "architect", iteration: 0 }),
    eventAt(11, {
      event: "agent.message",
      agent: "architect",
      text: "Mapped the REST endpoints, MongoDB collection, schemas, and test surface.",
    }),
    eventAt(13, {
      event: "agent.completed",
      agent: "architect",
      output_summary: { endpoints: 5, collections: 1, model: "demo/replay" },
      duration_ms: 5380,
    }),
    eventAt(14, {
      event: "approval.required",
      phase: "architect",
      payload: { endpoints: "5", collection: demo.label, files_planned: "main, models, schemas, database" },
    }),
    eventAt(16, { event: "approval.resolved", phase: "architect", approved: true, note: null }),
    eventAt(17, { event: "agent.started", agent: "coder", iteration: 0 }),
    eventAt(19, {
      event: "agent.message",
      agent: "coder",
      text: "Writing the complete FastAPI application and its data contracts.",
    }),
  ];

  Object.entries(demo.initialFiles).forEach(([path, content], index) => {
    events.push(eventAt(20 + index * 0.6, { event: "file.written", path, bytes: content.length }));
  });

  events.push(
    eventAt(24, {
      event: "agent.completed",
      agent: "coder",
      output_summary: { files: Object.keys(demo.initialFiles).length, model: "demo/replay" },
      duration_ms: 12100,
    }),
    eventAt(25, { event: "agent.started", agent: "reviewer", iteration: 0 }),
    eventAt(27, {
      event: "agent.message",
      agent: "reviewer",
      text: "main.py: the update route needs an explicit response model before this can pass review.",
    }),
    eventAt(29, {
      event: "agent.completed",
      agent: "reviewer",
      output_summary: { findings: 1, blocking: 1, passed: false, model: "demo/replay" },
      duration_ms: 4210,
    }),
    eventAt(30, {
      event: "loop.iteration",
      iteration: 1,
      trigger: "reviewer",
      blocking_findings: 1,
      failed_tests: 0,
    }),
    eventAt(31, { event: "agent.started", agent: "coder", iteration: 1 }),
    eventAt(33, {
      event: "agent.message",
      agent: "coder",
      text: "Applying the blocking review fix and preserving the rest of the generated tree.",
    }),
  );

  Object.entries(demo.finalFiles).forEach(([path, content], index) => {
    if (content === demo.initialFiles[path]) return;
    events.push(eventAt(34 + index * 0.5, { event: "file.written", path, bytes: content.length }));
  });

  events.push(
    eventAt(36, {
      event: "agent.completed",
      agent: "coder",
      output_summary: {
        files: Object.keys(demo.finalFiles).length,
        changelog: ["Added the missing response model."],
        model: "demo/replay",
      },
      duration_ms: 6840,
    }),
    eventAt(37, { event: "agent.started", agent: "reviewer", iteration: 1 }),
    eventAt(39, {
      event: "agent.completed",
      agent: "reviewer",
      output_summary: { findings: 0, blocking: 0, passed: true, model: "demo/replay" },
      duration_ms: 2970,
    }),
    eventAt(40, { event: "agent.started", agent: "tester", iteration: 1 }),
    eventAt(42, {
      event: "agent.message",
      agent: "tester",
      text: `Generated ${demo.tests} endpoint and behaviour tests for the repaired tree.`,
    }),
    eventAt(43, {
      event: "file.written",
      path: demo.testFile.path,
      bytes: demo.testFile.content.length,
    }),
    eventAt(44, {
      event: "agent.completed",
      agent: "tester",
      output_summary: { tests: demo.tests, model: "demo/replay" },
      duration_ms: 3560,
    }),
    eventAt(45, { event: "sandbox.started", image: "codeforge-sandbox:demo" }),
    eventAt(47, { event: "sandbox.output", stream: "stdout", chunk: "$ pytest -q\n" }),
    eventAt(49, {
      event: "sandbox.output",
      stream: "stdout",
      chunk: `${".".repeat(demo.tests)}\n${demo.tests} passed in 1.42s\n`,
    }),
    eventAt(50, { event: "tests.result", passed: true, total: demo.tests, failed: 0 }),
    eventAt(52, { event: "run.completed", status: "succeeded", iterations: 1, duration_ms: 52000 }),
  );

  return events.sort((a, b) => a.at.localeCompare(b.at));
}

const definitions: DemoRunDefinition[] = [
  {
    slug: "library",
    label: "Library",
    title: "Personal Library",
    prompt: "I want an API to manage a personal library of books — title, author, ISBN, genre, and whether I’ve read it.",
    preview: {
      id: "library",
      file: "main.py",
      result: "8 passed in 1.42s",
      lines: [
        "from fastapi import FastAPI",
        "from models import Book",
        "",
        "app = FastAPI()",
        "",
        '@app.post(\"/books\", status_code=201)',
        "async def create(book: BookIn):",
        "    doc = Book(**book.model_dump())",
        "    await doc.insert()",
        "    return BookOut(id=str(doc.id))",
      ],
    },
    initialFiles: {
      "main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.patch(\"/books/{book_id}\")\nasync def update(book_id: str, body: BookIn):\n    return await update_book(book_id, body)\n",
      "models.py": "from beanie import Document\n\nclass Book(Document):\n    title: str\n    author: str\n    isbn: str\n    read: bool = False\n",
      "schemas.py": "from pydantic import BaseModel\n\nclass BookIn(BaseModel):\n    title: str\n    author: str\n    isbn: str\n    read: bool = False\n\nclass BookOut(BookIn):\n    id: str\n",
      "database.py": "from motor.motor_asyncio import AsyncIOMotorClient\n\nclient = AsyncIOMotorClient(\"mongodb://localhost:27017\")\n",
    },
    finalFiles: {
      "main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.patch(\"/books/{book_id}\", response_model=BookOut)\nasync def update(book_id: str, body: BookIn):\n    return await update_book(book_id, body)\n",
      "models.py": "from beanie import Document\n\nclass Book(Document):\n    title: str\n    author: str\n    isbn: str\n    read: bool = False\n",
      "schemas.py": "from pydantic import BaseModel\n\nclass BookIn(BaseModel):\n    title: str\n    author: str\n    isbn: str\n    read: bool = False\n\nclass BookOut(BookIn):\n    id: str\n",
      "database.py": "from motor.motor_asyncio import AsyncIOMotorClient\n\nclient = AsyncIOMotorClient(\"mongodb://localhost:27017\")\n",
    },
    testFile: { path: "test_main.py", content: "def test_create_book(client):\n    response = client.post(\"/books\", json={\"title\": \"Networks\", \"author\": \"A. Author\", \"isbn\": \"123\"})\n    assert response.status_code == 201\n" },
    tests: 8,
  },
  {
    slug: "inventory",
    label: "Inventory",
    title: "Inventory Control",
    prompt: "Build an inventory API for products, stock levels, warehouses, and low-stock alerts.",
    preview: {
      id: "inventory",
      file: "routes.py",
      result: "10 passed in 1.68s",
      lines: [
        "from fastapi import APIRouter, HTTPException",
        "from schemas import StockUpdate",
        "",
        'router = APIRouter(prefix=\"/products\")',
        "",
        '@router.patch(\"/{product_id}/stock\")',
        "async def update_stock(product_id: str, body: StockUpdate):",
        "    product = await Product.get(product_id)",
        "    if not product: raise HTTPException(404)",
        "    return await product.set({Product.stock: body.stock})",
      ],
    },
    initialFiles: {
      "main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.patch(\"/products/{product_id}/stock\")\nasync def update_stock(product_id: str, body: StockUpdate):\n    return await change_stock(product_id, body)\n",
      "models.py": "from beanie import Document\n\nclass Product(Document):\n    name: str\n    stock: int = 0\n    warehouse: str\n",
      "schemas.py": "from pydantic import BaseModel\n\nclass StockUpdate(BaseModel):\n    stock: int\n\nclass ProductOut(BaseModel):\n    id: str\n    name: str\n    stock: int\n",
      "database.py": "from motor.motor_asyncio import AsyncIOMotorClient\n\nclient = AsyncIOMotorClient(\"mongodb://localhost:27017\")\n",
    },
    finalFiles: {
      "main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.patch(\"/products/{product_id}/stock\", response_model=ProductOut)\nasync def update_stock(product_id: str, body: StockUpdate):\n    return await change_stock(product_id, body)\n",
      "models.py": "from beanie import Document\n\nclass Product(Document):\n    name: str\n    stock: int = 0\n    warehouse: str\n",
      "schemas.py": "from pydantic import BaseModel\n\nclass StockUpdate(BaseModel):\n    stock: int\n\nclass ProductOut(BaseModel):\n    id: str\n    name: str\n    stock: int\n",
      "database.py": "from motor.motor_asyncio import AsyncIOMotorClient\n\nclient = AsyncIOMotorClient(\"mongodb://localhost:27017\")\n",
    },
    testFile: { path: "test_products.py", content: "def test_update_stock(client):\n    response = client.patch(\"/products/1/stock\", json={\"stock\": 12})\n    assert response.status_code in (200, 404)\n" },
    tests: 10,
  },
  {
    slug: "support",
    label: "Support",
    title: "Support Desk",
    prompt: "Create a support ticket API with priorities, assignees, status history, and comments.",
    preview: {
      id: "support",
      file: "tickets.py",
      result: "12 passed in 1.91s",
      lines: [
        "from datetime import datetime, timezone",
        "from fastapi import APIRouter",
        "",
        'router = APIRouter(prefix=\"/tickets\")',
        "",
        '@router.post(\"/\", status_code=201)',
        "async def open_ticket(body: TicketCreate):",
        "    ticket = Ticket(**body.model_dump())",
        "    ticket.opened_at = datetime.now(timezone.utc)",
        "    return await ticket.insert()",
      ],
    },
    initialFiles: {
      "main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.post(\"/tickets\", status_code=201)\nasync def open_ticket(body: TicketCreate):\n    return await create_ticket(body)\n",
      "models.py": "from beanie import Document\n\nclass Ticket(Document):\n    title: str\n    priority: str = \"normal\"\n    status: str = \"open\"\n",
      "schemas.py": "from pydantic import BaseModel\n\nclass TicketCreate(BaseModel):\n    title: str\n    priority: str = \"normal\"\n\nclass TicketOut(TicketCreate):\n    id: str\n    status: str\n",
      "database.py": "from motor.motor_asyncio import AsyncIOMotorClient\n\nclient = AsyncIOMotorClient(\"mongodb://localhost:27017\")\n",
    },
    finalFiles: {
      "main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.post(\"/tickets\", status_code=201, response_model=TicketOut)\nasync def open_ticket(body: TicketCreate):\n    return await create_ticket(body)\n",
      "models.py": "from beanie import Document\n\nclass Ticket(Document):\n    title: str\n    priority: str = \"normal\"\n    status: str = \"open\"\n",
      "schemas.py": "from pydantic import BaseModel\n\nclass TicketCreate(BaseModel):\n    title: str\n    priority: str = \"normal\"\n\nclass TicketOut(TicketCreate):\n    id: str\n    status: str\n",
      "database.py": "from motor.motor_asyncio import AsyncIOMotorClient\n\nclient = AsyncIOMotorClient(\"mongodb://localhost:27017\")\n",
    },
    testFile: { path: "test_tickets.py", content: "def test_open_ticket(client):\n    response = client.post(\"/tickets\", json={\"title\": \"Cannot sign in\"})\n    assert response.status_code == 201\n" },
    tests: 12,
  },
];

export const DEMO_RUNS: DemoRun[] = definitions.map((definition) => ({
  ...definition,
  events: buildEvents(definition),
}));

export function getDemoRun(slug: string): DemoRun {
  return DEMO_RUNS.find((demo) => demo.slug === slug) ?? DEMO_RUNS[0];
}
