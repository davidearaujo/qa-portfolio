// Generates TaskFlow.postman_collection.json
// Run with: node generate-collection.js
const fs = require("fs");
const path = require("path");

function req(name, method, urlPath, opts = {}) {
  const {
    body = null,
    auth = null, // "token" | "token2" | null
    query = [],
    tests = [],
    preRequest = [],
    description = "",
  } = opts;

  const headers = [{ key: "Content-Type", value: "application/json", type: "text" }];
  if (auth) {
    headers.push({
      key: "Authorization",
      value: `Bearer {{${auth}}}`,
      type: "text",
    });
  }

  const url = {
    raw: `{{baseUrl}}${urlPath}${query.length ? "?" + query.map((q) => `${q.key}=${q.value}`).join("&") : ""}`,
    host: ["{{baseUrl}}"],
    path: urlPath.split("/").filter(Boolean),
  };
  if (query.length) {
    url.query = query.map((q) => ({ key: q.key, value: q.value }));
  }

  const item = {
    name,
    event: [],
    request: {
      method,
      header: headers,
      url,
      description,
    },
    response: [],
  };

  if (body) {
    item.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } };
  }

  if (preRequest.length) {
    item.event.push({ listen: "prerequest", script: { type: "text/javascript", exec: preRequest } });
  }
  if (tests.length) {
    item.event.push({ listen: "test", script: { type: "text/javascript", exec: tests } });
  }

  return item;
}

// ---------- Shared test snippets ----------
const commonTests = {
  isJson: [
    'pm.test("Content-Type is application/json", function () {',
    '    pm.response.to.have.header("Content-Type");',
    '    pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");',
    "});",
  ],
  fastResponse: [
    'pm.test("Response time is acceptable (< 3000ms)", function () {',
    "    pm.expect(pm.response.responseTime).to.be.below(3000);",
    "});",
  ],
  status: (code) => [
    `pm.test("Status code is ${code}", function () {`,
    `    pm.response.to.have.status(${code});`,
    "});",
  ],
  errorShape: (code, messageIncludes) => [
    'pm.test("Error response has correct shape", function () {',
    "    const body = pm.response.json();",
    "    pm.expect(body).to.have.property('error');",
    "    pm.expect(body.error).to.have.property('code');",
    "    pm.expect(body.error).to.have.property('message');",
    `    pm.expect(body.error.code).to.eql("${code}");`,
    ...(messageIncludes
      ? [`    pm.expect(body.error.message.toLowerCase()).to.include("${messageIncludes.toLowerCase()}");`]
      : []),
    "});",
  ],
};

function authSuccessShape(varPrefix) {
  return [
    'pm.test("Response contains user and token", function () {',
    "    const body = pm.response.json();",
    "    pm.expect(body).to.have.property('user');",
    "    pm.expect(body.user).to.have.property('id');",
    "    pm.expect(body.user).to.have.property('email');",
    "    pm.expect(body.user).to.have.property('createdAt');",
    "    pm.expect(body).to.have.property('token');",
    "    pm.expect(body.token).to.be.a('string');",
    "});",
    `pm.environment.set("${varPrefix}", pm.response.json().token);`,
  ];
}

function taskShape(prefix) {
  return [
    `pm.test("Task response has correct shape", function () {`,
    "    const body = pm.response.json();",
    "    pm.expect(body).to.have.property('data');",
    "    const task = body.data;",
    "    pm.expect(task).to.have.property('id');",
    "    pm.expect(task).to.have.property('title');",
    "    pm.expect(task).to.have.property('description');",
    "    pm.expect(task).to.have.property('completed');",
    "    pm.expect(task).to.have.property('createdAt');",
    "    pm.expect(task).to.have.property('updatedAt');",
    "});",
  ];
}

// ================= HEALTH =================
const health = {
  name: "Health",
  item: [
    req("Health Check", "GET", "/health", {
      description: "Basic smoke test: confirms the API is up and responding.",
      tests: [
        ...commonTests.status(200),
        ...commonTests.isJson,
        ...commonTests.fastResponse,
        'pm.test("Body has status and timestamp", function () {',
        "    const body = pm.response.json();",
        '    pm.expect(body.status).to.eql("ok");',
        "    pm.expect(body).to.have.property('timestamp');",
        "});",
      ],
    }),
  ],
};

// ================= AUTH =================
const auth = {
  name: "Auth",
  item: [
    req("Register - Success", "POST", "/auth/register", {
      preRequest: [
        'const dynamicEmail = `qa.test.${Date.now()}@example.com`;',
        'pm.environment.set("existingEmail", dynamicEmail);',
      ],
      body: { email: "{{existingEmail}}", password: "{{userPassword}}" },
      tests: [
        ...commonTests.status(201),
        ...commonTests.isJson,
        ...commonTests.fastResponse,
        ...authSuccessShape("token"),
        'pm.environment.set("userId", pm.response.json().user.id);',
      ],
    }),
    req("Register - Duplicate Email (409)", "POST", "/auth/register", {
      body: { email: "{{existingEmail}}", password: "{{userPassword}}" },
      tests: [
        ...commonTests.status(409),
        ...commonTests.isJson,
        ...commonTests.errorShape("CONFLICT", "already exists"),
      ],
    }),
    req("Register - Invalid Email Format (400)", "POST", "/auth/register", {
      body: { email: "not-an-email", password: "{{userPassword}}" },
      tests: [
        ...commonTests.status(400),
        ...commonTests.isJson,
        ...commonTests.errorShape("VALIDATION_ERROR"),
        'pm.test("Field error mentions email", function () {',
        "    const body = pm.response.json();",
        "    pm.expect(body.error.details.fieldErrors).to.have.property('email');",
        "});",
      ],
    }),
    req("Register - Weak Password (400)", "POST", "/auth/register", {
      body: { email: "someone.new@example.com", password: "123" },
      tests: [
        ...commonTests.status(400),
        ...commonTests.errorShape("VALIDATION_ERROR"),
        'pm.test("Field error mentions password", function () {',
        "    const body = pm.response.json();",
        "    pm.expect(body.error.details.fieldErrors).to.have.property('password');",
        "});",
      ],
    }),
    req("Register - Missing Fields (400)", "POST", "/auth/register", {
      body: {},
      tests: [...commonTests.status(400), ...commonTests.errorShape("VALIDATION_ERROR")],
    }),
    req("Login - Success", "POST", "/auth/login", {
      body: { email: "{{existingEmail}}", password: "{{userPassword}}" },
      tests: [
        ...commonTests.status(200),
        ...commonTests.isJson,
        ...commonTests.fastResponse,
        ...authSuccessShape("token"),
      ],
    }),
    req("Login - Wrong Password (401)", "POST", "/auth/login", {
      body: { email: "{{existingEmail}}", password: "definitelyWrongPassword" },
      tests: [
        ...commonTests.status(401),
        ...commonTests.errorShape("UNAUTHORIZED", "invalid email or password"),
      ],
    }),
    req("Login - Unknown Email (401)", "POST", "/auth/login", {
      body: { email: "nobody-registered-with-this@example.com", password: "{{userPassword}}" },
      tests: [
        ...commonTests.status(401),
        ...commonTests.errorShape("UNAUTHORIZED", "invalid email or password"),
        'pm.test("Same message as wrong-password case (no email enumeration)", function () {',
        "    const body = pm.response.json();",
        '    pm.expect(body.error.message).to.eql("Invalid email or password");',
        "});",
      ],
    }),
    req("Login - Invalid Email Format (400)", "POST", "/auth/login", {
      body: { email: "not-an-email", password: "{{userPassword}}" },
      tests: [...commonTests.status(400), ...commonTests.errorShape("VALIDATION_ERROR")],
    }),
  ],
};

// ================= TASKS =================
const tasks = {
  name: "Tasks",
  item: [
    req("Create Task - Success", "POST", "/tasks", {
      auth: "token",
      body: { title: "Write QA plan", description: "Draft the test strategy doc" },
      tests: [
        ...commonTests.status(201),
        ...commonTests.isJson,
        ...commonTests.fastResponse,
        ...taskShape(),
        'pm.environment.set("taskId", pm.response.json().data.id);',
        'pm.test("New task is not completed by default", function () {',
        "    pm.expect(pm.response.json().data.completed).to.eql(false);",
        "});",
      ],
    }),
    req("Create Task - For Ownership Test", "POST", "/tasks", {
      auth: "token",
      body: { title: "Owned by user A", description: "Used to test cross-user access" },
      tests: [
        ...commonTests.status(201),
        'pm.environment.set("ownershipTaskId", pm.response.json().data.id);',
      ],
    }),
    req("Create Task - Missing Title (400)", "POST", "/tasks", {
      auth: "token",
      body: { description: "No title provided" },
      tests: [...commonTests.status(400), ...commonTests.errorShape("VALIDATION_ERROR")],
    }),
    req("Create Task - Title Too Long (400)", "POST", "/tasks", {
      auth: "token",
      body: { title: "x".repeat(201) },
      tests: [...commonTests.status(400), ...commonTests.errorShape("VALIDATION_ERROR")],
    }),
    req("Create Task - No Auth (401)", "POST", "/tasks", {
      body: { title: "Should be rejected" },
      tests: [
        ...commonTests.status(401),
        ...commonTests.errorShape("UNAUTHORIZED", "Missing or malformed"),
      ],
    }),
    req("List Tasks - Success", "GET", "/tasks", {
      auth: "token",
      tests: [
        ...commonTests.status(200),
        ...commonTests.isJson,
        ...commonTests.fastResponse,
        'pm.test("Response has data array and pagination object", function () {',
        "    const body = pm.response.json();",
        "    pm.expect(body).to.have.property('data').that.is.an('array');",
        "    pm.expect(body).to.have.property('pagination');",
        "    pm.expect(body.pagination).to.have.all.keys('page', 'limit', 'total', 'totalPages');",
        "});",
      ],
    }),
    req("List Tasks - Filter Completed=false", "GET", "/tasks", {
      auth: "token",
      query: [{ key: "completed", value: "false" }],
      tests: [
        ...commonTests.status(200),
        'pm.test("Every returned task has completed=false", function () {',
        "    const body = pm.response.json();",
        "    body.data.forEach((t) => pm.expect(t.completed).to.eql(false));",
        "});",
      ],
    }),
    req("List Tasks - Invalid Page Param (400)", "GET", "/tasks", {
      auth: "token",
      query: [{ key: "page", value: "not-a-number" }],
      tests: [...commonTests.status(400), ...commonTests.errorShape("VALIDATION_ERROR")],
    }),
    req("List Tasks - No Auth (401)", "GET", "/tasks", {
      tests: [...commonTests.status(401), ...commonTests.errorShape("UNAUTHORIZED")],
    }),
    req("Get Task By Id - Success", "GET", "/tasks/{{taskId}}", {
      auth: "token",
      tests: [...commonTests.status(200), ...commonTests.isJson, ...taskShape()],
    }),
    req("Get Task By Id - Not Found (404)", "GET", "/tasks/999999", {
      auth: "token",
      tests: [...commonTests.status(404), ...commonTests.errorShape("NOT_FOUND")],
    }),
    req("Get Task By Id - Invalid Id Format (400)", "GET", "/tasks/not-an-id", {
      auth: "token",
      tests: [...commonTests.status(400), ...commonTests.errorShape("BAD_REQUEST")],
    }),
    req("Get Task By Id - No Auth (401)", "GET", "/tasks/{{taskId}}", {
      tests: [...commonTests.status(401), ...commonTests.errorShape("UNAUTHORIZED")],
    }),
    req("Update Task - Mark Complete", "PATCH", "/tasks/{{taskId}}", {
      auth: "token",
      body: { completed: true },
      tests: [
        ...commonTests.status(200),
        ...taskShape(),
        'pm.test("Task is now marked completed", function () {',
        "    pm.expect(pm.response.json().data.completed).to.eql(true);",
        "});",
      ],
    }),
    req("Update Task - Empty Body (400)", "PATCH", "/tasks/{{taskId}}", {
      auth: "token",
      body: {},
      tests: [...commonTests.status(400), ...commonTests.errorShape("VALIDATION_ERROR")],
    }),
    req("Update Task - Not Found (404)", "PATCH", "/tasks/999999", {
      auth: "token",
      body: { title: "Doesn't matter" },
      tests: [...commonTests.status(404), ...commonTests.errorShape("NOT_FOUND")],
    }),
    req("Update Task - No Auth (401)", "PATCH", "/tasks/{{taskId}}", {
      body: { title: "Should be rejected" },
      tests: [...commonTests.status(401), ...commonTests.errorShape("UNAUTHORIZED")],
    }),
    req("Delete Task - Not Found (404)", "DELETE", "/tasks/999999", {
      auth: "token",
      tests: [...commonTests.status(404), ...commonTests.errorShape("NOT_FOUND")],
    }),
    req("Delete Task - No Auth (401)", "DELETE", "/tasks/{{taskId}}", {
      tests: [...commonTests.status(401), ...commonTests.errorShape("UNAUTHORIZED")],
    }),
    req("Delete Task - Success (204)", "DELETE", "/tasks/{{taskId}}", {
      auth: "token",
      tests: [
        ...commonTests.status(204),
        'pm.test("Response body is empty", function () {',
        "    pm.expect(pm.response.text()).to.have.lengthOf(0);",
        "});",
      ],
    }),
  ],
};

// ================= CROSS-USER OWNERSHIP =================
const ownership = {
  name: "Cross-User Ownership",
  description:
    "Blackbox tests confirming a user can never read, modify, or delete another user's tasks. " +
    "The API deliberately returns 404 (not 403) to avoid confirming the resource exists.",
  item: [
    req("Register Second User", "POST", "/auth/register", {
      preRequest: [
        'const dynamicEmail = `qa.userB.${Date.now()}@example.com`;',
        'pm.environment.set("existingEmailB", dynamicEmail);',
      ],
      body: { email: "{{existingEmailB}}", password: "{{userPassword}}" },
      tests: [...commonTests.status(201), ...authSuccessShape("token2")],
    }),
    req("Get User A's Task As User B (404)", "GET", "/tasks/{{ownershipTaskId}}", {
      auth: "token2",
      tests: [
        ...commonTests.status(404),
        ...commonTests.errorShape("NOT_FOUND"),
        'pm.test("Does not reveal the task exists (403 would leak that)", function () {',
        "    pm.response.to.not.have.status(403);",
        "});",
      ],
    }),
    req("Update User A's Task As User B (404)", "PATCH", "/tasks/{{ownershipTaskId}}", {
      auth: "token2",
      body: { completed: true },
      tests: [...commonTests.status(404), ...commonTests.errorShape("NOT_FOUND")],
    }),
    req("Delete User A's Task As User B (404)", "DELETE", "/tasks/{{ownershipTaskId}}", {
      auth: "token2",
      tests: [...commonTests.status(404), ...commonTests.errorShape("NOT_FOUND")],
    }),
    req("Cleanup: Delete Ownership Task As Owner", "DELETE", "/tasks/{{ownershipTaskId}}", {
      auth: "token",
      tests: [...commonTests.status(204)],
    }),
  ],
};

// ================= DATA-DRIVEN VALIDATION =================
const dataDriven = {
  name: "Data-Driven Validation",
  description:
    "Run this folder with the Collection Runner (or Newman with -d) using " +
    "data/register-validation-data.csv to sweep many invalid registration payloads in one pass.",
  item: [
    req("Register - Data-Driven Invalid Payloads", "POST", "/auth/register", {
      body: { email: "{{email}}", password: "{{password}}" },
      tests: [
        'const expected = Number(pm.iterationData.get("expectedStatus"));',
        'pm.test(`Status code matches expected (${expected})`, function () {',
        "    pm.response.to.have.status(expected);",
        "});",
        'pm.test("Response has consistent shape for its status", function () {',
        "    const body = pm.response.json();",
        "    if (pm.response.code >= 400) {",
        "        pm.expect(body).to.have.property('error');",
        "    } else {",
        "        pm.expect(body).to.have.property('token');",
        "    }",
        "});",
      ],
    }),
  ],
};

const collection = {
  info: {
    name: "TaskFlow API",
    description:
      "Blackbox API test suite for the TaskFlow API. Covers happy paths, validation errors, " +
      "auth failures, not-found cases, conflicts, ownership isolation, and pagination — " +
      "asserting status codes, response shapes, error messages, and headers throughout.\n\n" +
      "Run order matters: Auth must run before Tasks (Tasks depends on {{token}}), and " +
      "Tasks must run before Cross-User Ownership (depends on {{ownershipTaskId}}).",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [health, auth, tasks, ownership, dataDriven],
};

const outPath = path.join(__dirname, "collections", "TaskFlow.postman_collection.json");
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2));
console.log("Wrote", outPath);
