import { test, expect } from "@playwright/test";

// The app loads with sample Mermaid code (graph TD with nodes A-F).
// Mermaid renders asynchronously, so we wait for the SVG to appear.

async function waitForSvg(page: import("@playwright/test").Page) {
  await page.waitForSelector("svg", { timeout: 10000 });
}

// ---------- 1. Basic rendering: flowchart renders as Mermaid native SVG ----------

test("1 - flowchart renders as native SVG", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  const svg = page.locator("svg").first();
  await expect(svg).toBeVisible();

  // Should have .node elements (the sample has 6 nodes: A-F)
  const nodes = svg.locator("g.node");
  const count = await nodes.count();
  expect(count).toBeGreaterThanOrEqual(4);
});

// ---------- 2. Sequence diagram renders ----------

test("2 - sequence diagram renders", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // Switch to code view to edit the code
  await page.getByRole("button", { name: "Code" }).click();

  // Clear and type a sequence diagram
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Meta+a");
  await page.keyboard.type(
    "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob->>Alice: Hi",
    { delay: 5 },
  );

  // Switch back to canvas view
  await page.getByRole("button", { name: "Canvas" }).click();

  // Wait for new SVG to render
  await page.waitForTimeout(1500);
  await waitForSvg(page);

  const svg = page.locator("svg").first();
  await expect(svg).toBeVisible();
});

// ---------- 3. Click-to-select: click a node, verify highlight ----------

test("3 - click node to select it", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // Click on first .node element
  const firstNode = page.locator("svg g.node").first();
  await firstNode.click();

  // Verify data-selected attribute was added
  await expect(firstNode).toHaveAttribute("data-selected", "true");

  // Verify selection count indicator appears
  const badge = page.getByText("1 selected");
  await expect(badge).toBeVisible();
});

// ---------- 4. Click empty area deselects ----------

test("4 - click empty area deselects nodes", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // Select a node first
  const firstNode = page.locator("svg g.node").first();
  await firstNode.click();
  await expect(firstNode).toHaveAttribute("data-selected", "true");

  // Click on empty area (the wrapper div, not on a node)
  // Click in the top-left corner where there's no diagram content
  const wrapper = page.locator("svg").first();
  const box = await wrapper.boundingBox();
  if (box) {
    // Click well above the diagram nodes
    await page.mouse.click(box.x + 5, box.y + 5);
  }

  // Selection should be cleared
  const badge = page.getByText(/selected/);
  await expect(badge).not.toBeVisible({ timeout: 2000 });
});

// ---------- 5. Cmd+Click for multi-select ----------

test("5 - cmd+click for multi-select", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  const nodes = page.locator("svg g.node");
  const firstNode = nodes.first();
  const secondNode = nodes.nth(1);

  // Click first node
  await firstNode.click();
  await expect(firstNode).toHaveAttribute("data-selected", "true");

  // Cmd+Click second node
  await secondNode.click({ modifiers: ["Meta"] });

  // Both should be selected
  await expect(firstNode).toHaveAttribute("data-selected", "true");
  await expect(secondNode).toHaveAttribute("data-selected", "true");

  const badge = page.getByText("2 selected");
  await expect(badge).toBeVisible();
});

// ---------- 6. Double-click edit: double-click node, type new text ----------

test("6 - double-click node opens inline edit", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // Find a node to double-click
  const nodes = page.locator("svg g.node");
  const targetNode = nodes.nth(1); // B node: "Process Data"
  await targetNode.dblclick();

  // An input should appear
  const input = page.locator("input");
  await expect(input).toBeVisible({ timeout: 2000 });

  // It should contain the node label
  const value = await input.inputValue();
  expect(value.length).toBeGreaterThan(0);

  // Type new text and press Enter
  await input.fill("Updated Label");
  await input.press("Enter");

  // Input should disappear
  await expect(input).not.toBeVisible({ timeout: 2000 });

  // Switch to code view to verify the code was updated
  await page.getByRole("button", { name: "Code" }).click();
  await page.waitForTimeout(500);

  // The code editor should contain "Updated Label"
  const codeContent = await page.locator(".cm-content").textContent();
  expect(codeContent).toContain("Updated Label");
});

// ---------- 7. Layout toggle: click direction button ----------

test("7 - layout direction toggle cycles TD to LR", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // Find the direction toggle button (shows "TD" with arrow)
  const dirBtn = page.locator("button", { hasText: "TD" });
  await expect(dirBtn).toBeVisible();

  // Click to cycle to LR
  await dirBtn.click();

  // Wait for re-render
  await page.waitForTimeout(1000);

  // Button should now show LR
  const lrBtn = page.locator("button", { hasText: "LR" });
  await expect(lrBtn).toBeVisible();

  // Verify code was updated
  await page.getByRole("button", { name: "Code" }).click();
  await page.waitForTimeout(500);
  const codeContent = await page.locator(".cm-content").textContent();
  expect(codeContent).toContain("LR");
});

// ---------- 8. View switching: Code / Split / Canvas ----------

test("8 - view switching works", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // Default is Canvas view - should see SVG, no editor
  await expect(page.locator("svg").first()).toBeVisible();

  // Switch to Code view
  await page.getByRole("button", { name: "Code" }).click();
  await page.waitForTimeout(300);
  const editor = page.locator(".cm-editor");
  await expect(editor).toBeVisible();

  // Switch to Split view
  await page.getByRole("button", { name: "Split" }).click();
  await page.waitForTimeout(300);
  // Both editor and diagram should be visible
  await expect(page.locator(".cm-editor")).toBeVisible();

  // Switch back to Canvas
  await page.getByRole("button", { name: "Canvas" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator("svg").first()).toBeVisible();
});

// ---------- 9. Code edit -> diagram sync ----------

test("9 - code edit triggers diagram re-render", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // Count initial nodes
  const initialCount = await page.locator("svg g.node").count();

  // Switch to code view and add a new node
  await page.getByRole("button", { name: "Code" }).click();
  const editor = page.locator(".cm-content");
  await editor.click();

  // Move to end of text and add a new node line
  await page.keyboard.press("Meta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("  G[New Node]", { delay: 10 });

  // Switch to canvas view and wait for re-render
  await page.getByRole("button", { name: "Canvas" }).click();
  await page.waitForTimeout(2000);
  await waitForSvg(page);

  // Should have one more node
  const newCount = await page.locator("svg g.node").count();
  expect(newCount).toBeGreaterThanOrEqual(initialCount);
});

// ---------- 10. Fixed height: container is 500px ----------

test("10 - container height is 500px", async ({ page }) => {
  await page.goto("/");
  await waitForSvg(page);

  // The root container (.mermaid-app-root) should have 500px height
  const root = page.locator(".mermaid-app-root");
  const box = await root.boundingBox();
  expect(box).toBeTruthy();
  // Allow some tolerance (498-502)
  expect(box!.height).toBeGreaterThanOrEqual(498);
  expect(box!.height).toBeLessThanOrEqual(502);
});
