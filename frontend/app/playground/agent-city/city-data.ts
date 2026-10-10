export const stations = [
  { id: "pm", name: "PM", place: "Idea office", color: "#e6a35e", x: -5.8, z: -4.4, line: "An idea without a scope is just a very enthusiastic bug.", task: "Pick an idea. I’ll turn it into a small, clear set of requirements.", action: "Approve requirements", artifact: "Create, list, update, and delete items.\nKeep the first version focused." },
  { id: "architect", name: "Architect", place: "Blueprint studio", color: "#83afc8", x: 2.1, z: -6.5, line: "Measure twice. Name your endpoints once.", task: "A resource, five routes, and one clean data model. Ready to approve the plan?", action: "Approve the plan", artifact: "POST   /items\nGET    /items\nGET    /items/{id}\nPATCH  /items/{id}\nDELETE /items/{id}" },
  { id: "coder", name: "Coder", place: "Build workshop", color: "#a2b782", x: 6.5, z: -0.3, line: "It works on my island. That counts, right?", task: "I’ve got the plan. Let’s turn those routes into a tiny service.", action: "Assemble the service", artifact: "app/\n  routes.py\n  models.py\n  schemas.py\n  database.py" },
  { id: "reviewer", name: "Reviewer", place: "Review checkpoint", color: "#bd9fcb", x: 2.8, z: 6.2, line: "Nice code. One tiny comment. Okay, three tiny comments.", task: "Input checks, clear errors, and a second pair of eyes. The service is looking good.", action: "Apply the review", artifact: "✓ Check input validation\n✓ Review error responses\n✓ Match the approved plan" },
  { id: "tester", name: "Tester", place: "Test lab", color: "#dc8f91", x: -5.4, z: 5.1, line: "I tried deleting a book that doesn’t exist. You’re welcome.", task: "Time to try the happy paths and the awkward ones. Let’s finish this little adventure.", action: "Run the quest tests", artifact: "✓ Create an item\n✓ Read the collection\n✓ Update an item\n✓ Delete an item\n✓ Reject invalid input" },
] as const;

export type CitySnapshot = {
  started: boolean;
  stage: number;
  collected: number[];
  night: boolean;
  paused: boolean;
  reducedMotion: boolean;
  secret: boolean;
};

export const bugs = [
  { x: -5.8, z: 8.0, name: "Off-by-one bug" },
  { x: 5.9, z: 4.0, name: "Works-on-my-machine bug" },
  { x: -4, z: -8.8, name: "Missing-semicolon bug" },
];
