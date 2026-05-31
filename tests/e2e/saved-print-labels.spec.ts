import { expect, type Page, test } from "@playwright/test";
import { inflateSync } from "node:zlib";

const labelPrintPayloadStorageKey = "cuteqrcodes.labelPrintPayload";

const savedQrCode = {
  createdAt: "2026-05-26T00:00:00.000Z",
  id: "saved-print",
  name: "Saved print link",
  payload: {
    additionalText: "",
    additionalTextFont: "google-sans",
    additionalTextPlacement: "below",
    additionalTextSizeStep: 0,
    border: "none",
    centerIcon: "none",
    colorName: null,
    colorStep: 500,
    label: "Saved",
    labelFont: "google-sans",
    labelPosition: "bottom",
    labelSizeStep: 0,
    url: "https://example.com/saved-print-link",
    version: 1,
  },
  previewHeight: 21,
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="white"/><rect x="1" y="1" width="19" height="19" fill="black"/></svg>',
  previewWidth: 21,
  status: "draft",
  tags: [],
  pdfPurchaseId: null,
  updatedAt: "2026-05-26T00:00:00.000Z",
};

const tallSavedQrCode = {
  ...savedQrCode,
  id: "saved-tall",
  name: "Tall saved print link",
  previewHeight: 100,
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 100"><rect width="70" height="100" fill="white"/><rect x="5" y="5" width="60" height="90" fill="black"/></svg>',
  previewWidth: 70,
};

const wideSavedQrCode = {
  ...savedQrCode,
  id: "saved-wide",
  name: "Wide saved print link",
  previewHeight: 70,
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><rect width="100" height="70" fill="white"/><rect x="5" y="5" width="90" height="60" fill="black"/></svg>',
  previewWidth: 100,
};

const circleSavedQrCode = {
  ...savedQrCode,
  id: "saved-circle",
  name: "Circle saved print link",
  payload: {
    ...savedQrCode.payload,
    shape: "circle",
  },
  previewHeight: 30,
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><rect width="30" height="30" fill="white"/><circle cx="15" cy="15" r="15" fill="black"/></svg>',
  previewWidth: 30,
};

const purchasedQrCode = {
  ...savedQrCode,
  id: "purchased-menu",
  name: "Purchased menu QR",
  payload: {
    ...savedQrCode.payload,
    dynamicLink: {
      destinationUrl: "https://example.com/menu",
      id: "dynamic-menu",
      redirectUrl: "https://qrcodesonlabels.com/r/menu",
      slug: "menu",
      trackStatistics: true,
      useDynamicUrl: true,
    },
    url: "https://example.com/menu",
  },
  pdfPurchaseId: "pdf-menu",
  status: "purchased",
  tags: ["menu", "paid"],
};

async function routeSavedPrintFixtures(
  page: Page,
  {
    balance = 0,
    qrCode = savedQrCode,
  }: { balance?: number; qrCode?: typeof savedQrCode } = {},
) {
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          createdAt: "2026-05-26T00:00:00.000Z",
          expiresAt: "2026-06-26T00:00:00.000Z",
          id: "session-print",
          token: "session-print",
          updatedAt: "2026-05-26T00:00:00.000Z",
          userId: "user-print",
        },
        user: {
          createdAt: "2026-05-26T00:00:00.000Z",
          email: "print@example.com",
          emailVerified: true,
          id: "user-print",
          name: "print@example.com",
          updatedAt: "2026-05-26T00:00:00.000Z",
        },
      }),
    }),
  );
  await page.route(/\/api\/qr\/saved$/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        qrCodes: [qrCode],
        tags: qrCode.tags,
      }),
    }),
  );
  await page.route(`**/api/qr/saved/${qrCode.id}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ qrCode }),
    }),
  );
  await page.route("**/api/credits/summary", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        balance,
        packs: [],
        pdfs: [],
        transactions: [],
      }),
    }),
  );
}

type CapturedPdfPurchase = {
  pdfBase64: string;
  templateId: string;
};

async function routePdfPurchaseCapture(
  page: Page,
  capturedPurchases: CapturedPdfPurchase[],
) {
  await page.route("**/api/credits/pdf-purchases", async (route) => {
    const body = route.request().postDataJSON() as {
      pdfBase64?: string;
      qrTitle?: string;
      templateId?: string;
    };
    const templateId = body.templateId ?? "unknown-template";
    const pdfBase64 = body.pdfBase64 ?? "";

    capturedPurchases.push({ pdfBase64, templateId });

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        balance: 25,
        pdf: {
          createdAt: "2026-05-26T00:00:00.000Z",
          downloadUrl: `https://example.com/${templateId}.pdf`,
          id: `pdf-${capturedPurchases.length}`,
          qrTitle: body.qrTitle ?? "Saved print link",
          sizeBytes: Buffer.from(pdfBase64, "base64").byteLength,
          templateId,
          templateLabel: templateId,
        },
      }),
    });
  });
}

async function purchaseTemplatePdf(
  page: Page,
  capturedPurchases: CapturedPdfPurchase[],
  templateId: string,
) {
  const expectedPurchaseCount = capturedPurchases.length + 1;

  await page.getByTestId(`label-template-purchase-button-${templateId}`).click();
  await expect
    .poll(() => capturedPurchases.length)
    .toBe(expectedPurchaseCount);

  return capturedPurchases[expectedPurchaseCount - 1]!;
}

test("saved QR print link loads labels from the saved id", async ({ page }) => {
  await routeSavedPrintFixtures(page);

  await page.goto("/saved-qr-codes");
  await expect(page.getByText("Saved print link")).toBeVisible();

  await page.getByRole("button", { name: "Print to Labels" }).click();

  await expect(page).toHaveURL(/\/print-labels\?saved=saved-print$/);
  await expect(page.getByText("Saved print link")).toBeVisible();

  const printLabelsPage = await page
    .getByTestId("print-labels-page")
    .boundingBox();
  const desktopTemplateLayout = await page.evaluate(() => {
    const page = document.querySelector(
      '[data-testid="print-labels-page"]',
    ) as HTMLElement | null;
    const grid = document.querySelector(
      '[data-testid="label-template-grid"]',
    ) as HTMLElement | null;
    const card = document.querySelector(
      '[data-testid="label-template-card-avery-presta-94100"]',
    ) as HTMLElement | null;

    if (!page || !grid || !card) {
      throw new Error("Missing print labels layout elements.");
    }

    const pageBox = page.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();

    return {
      cardWidth: cardBox.width,
      columns: getComputedStyle(grid).gridTemplateColumns
        .split(" ")
        .filter(Boolean).length,
      gridCenterOffset: Math.abs(
        gridBox.left + gridBox.width / 2 - (pageBox.left + pageBox.width / 2),
      ),
      gridWidth: gridBox.width,
    };
  });

  expect(printLabelsPage?.width).toBeGreaterThan(1000);
  expect(desktopTemplateLayout.columns).toBe(1);
  expect(desktopTemplateLayout.cardWidth).toBeGreaterThan(900);
  expect(desktopTemplateLayout.gridWidth).toBeGreaterThan(900);
  expect(desktopTemplateLayout.gridCenterOffset).toBeLessThan(2);
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94100"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94101"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94107"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94106"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94103"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94107"),
  ).toHaveText('2"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94107"),
  ).toHaveText('2"');
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94106"),
  ).toHaveText('1.5"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94106"),
  ).toHaveText('1.5"');
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94103"),
  ).toHaveText('1"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94103"),
  ).toHaveText('1"');

  await page.getByRole("radio", { name: "Rectangle" }).click();
  await expect(
    page.getByTestId("label-template-preview-avery-presta-94256"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94256"),
  ).toHaveText('3.5"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94256"),
  ).toHaveText('5"');

  const largeRectanglePreview = await page
    .getByTestId("label-template-preview-avery-presta-94256")
    .boundingBox();

  expect(largeRectanglePreview?.width).toBeCloseTo(336, 0);
  expect(largeRectanglePreview?.height).toBeCloseTo(480, 0);

  const wideLabelPreview = await page
    .getByTestId("label-template-preview-avery-presta-94207")
    .boundingBox();

  expect(wideLabelPreview?.width).toBeCloseTo(384, 0);
  expect(wideLabelPreview?.height).toBeCloseTo(192, 0);
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94207"),
  ).toHaveText('4"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94207"),
  ).toHaveText('2"');

  await expect(page.getByRole("combobox", { name: "Sort By" })).toHaveText(
    "Largest to Smallest",
  );
  await page.getByRole("combobox", { name: "Sort By" }).click();
  await page.getByRole("option", { name: "Smallest to Largest" }).click();
  await expect(
    page.getByTestId("label-template-preview-avery-presta-94237"),
  ).toBeVisible();

  const smallRectanglePreviewTop = await page
    .getByTestId("label-template-preview-avery-presta-94237")
    .evaluate((element) => element.getBoundingClientRect().top);
  const largeRectanglePreviewTop = await page
    .getByTestId("label-template-preview-avery-presta-94256")
    .evaluate((element) => element.getBoundingClientRect().top);

  expect(smallRectanglePreviewTop).toBeLessThan(largeRectanglePreviewTop);

  await page.getByRole("radio", { name: "Circle" }).click();
  await expect(
    page.getByTestId("label-template-preview-avery-presta-94514"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94514"),
  ).toHaveText('3.5"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94514"),
  ).toHaveText('3.5"');

  const largeCirclePreview = await page
    .getByTestId("label-template-preview-avery-presta-94514")
    .boundingBox();

  expect(largeCirclePreview?.width).toBeCloseTo(336, 0);
  expect(largeCirclePreview?.height).toBeCloseTo(336, 0);

  await page.getByRole("radio", { name: "Jumbo" }).click();
  await expect(
    page.getByTestId("label-template-preview-avery-presta-94268"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94268"),
  ).toHaveText('8.5"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94268"),
  ).toHaveText('11"');
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94261"),
  ).toHaveText('8"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94261"),
  ).toHaveText('3.5"');
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94229"),
  ).toHaveText('8.5"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94229"),
  ).toHaveText('5.5"');

  await page.getByRole("radio", { name: "Rectangle" }).click();

  const rotatedArtwork = await page
    .getByTestId("label-template-artwork-avery-presta-94207")
    .boundingBox();

  expect(rotatedArtwork?.width).toBeCloseTo(168, 0);
  expect(rotatedArtwork?.height).toBeCloseTo(168, 0);

  await page.setViewportSize({ width: 320, height: 720 });

  const widePreviewScroller = page.getByTestId(
    "label-template-preview-scroll-avery-presta-94207",
  );
  const mobileOverflow = await widePreviewScroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    touchAction: getComputedStyle(element).touchAction,
  }));

  expect(mobileOverflow.scrollWidth).toBeGreaterThan(
    mobileOverflow.clientWidth,
  );
  expect(mobileOverflow.touchAction).toContain("pan");

  const printUrl = page.url();

  await page.evaluate(() => sessionStorage.clear());
  await page.goto(printUrl);

  await expect(page.getByText("Saved print link")).toBeVisible();
  await expect(page.getByText("No QR code is ready for labels.")).toBeHidden();
});

test("my QR codes shows draft and purchased QR actions with tag filtering", async ({
  page,
}) => {
  let dynamicUpdateRequest:
    | {
        destinationUrl?: string;
        existingLinkId?: string;
        slug?: string;
        trackStatistics?: boolean;
        useDynamicUrl?: boolean;
      }
    | null = null;
  let tagUpdateRequest: { tags?: string[] } | null = null;

  await routeSavedPrintFixtures(page, {
    qrCode: {
      ...savedQrCode,
      tags: ["draft"],
    },
  });
  await page.route(/\/api\/qr\/saved$/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        qrCodes: [
          {
            ...savedQrCode,
            tags: ["draft"],
          },
          purchasedQrCode,
        ],
        tags: ["draft", "menu", "paid"],
      }),
    }),
  );
  await page.route("**/api/qr/dynamic-links", async (route) => {
    dynamicUpdateRequest = route.request().postDataJSON();

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        balance: 10,
        link: {
          ...purchasedQrCode.payload.dynamicLink,
          destinationUrl: "https://example.com/new-menu",
        },
      }),
    });
  });
  await page.route(`**/api/qr/saved/${purchasedQrCode.id}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as { dynamicLink?: unknown; tags?: string[] };

    if (Array.isArray(body.tags)) {
      tagUpdateRequest = body;

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          qrCode: {
            ...purchasedQrCode,
            tags: body.tags,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        qrCode: {
          ...purchasedQrCode,
          payload: {
            ...purchasedQrCode.payload,
            dynamicLink: {
              ...purchasedQrCode.payload.dynamicLink,
              destinationUrl: "https://example.com/new-menu",
            },
          },
        },
      }),
    });
  });
  await page.route("**/api/qr/dynamic-links/dynamic-menu/stats", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        lastScannedAt: "2026-05-28T18:00:00.000Z",
        recentScans: [
          {
            city: "Livermore",
            country: "US",
            id: "scan-1",
            region: "CA",
            scannedAt: "2026-05-28T18:00:00.000Z",
          },
        ],
        scansByCountry: [{ count: 2, label: "US" }],
        scansByDay: [{ count: 2, label: "2026-05-28" }],
        totalScans: 2,
      }),
    }),
  );

  await page.goto("/saved-qr-codes");

  await expect(page.getByRole("heading", { name: "My QR Codes" }).first()).toBeVisible();
  await expect(page.getByText("Saved print link")).toBeVisible();
  await expect(page.getByText("Purchased menu QR")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit QR Code" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy To New QR Code" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
    "href",
    "/api/credits/pdfs/pdf-menu",
  );
  await expect(page.getByRole("button", { name: "Edit URL" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View Stats" })).toBeVisible();

  await page.getByRole("button", { name: "paid" }).first().click();
  await expect(page.getByText("Saved print link")).toHaveCount(0);
  await expect(page.getByText("Purchased menu QR")).toBeVisible();

  await page.getByRole("button", { name: "Remove menu" }).click();
  const removeTagDialog = page.getByRole("dialog", { name: "Remove Tag" });
  await expect(removeTagDialog).toBeVisible();
  await expect(removeTagDialog).toContainText(
    'Remove "menu" from "Purchased menu QR"?',
  );
  await removeTagDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(removeTagDialog).toHaveCount(0);
  expect(tagUpdateRequest).toBeNull();

  await page.getByRole("button", { name: "Remove menu" }).click();
  await removeTagDialog.getByRole("button", { name: "Remove Tag" }).click();
  await expect.poll(() => tagUpdateRequest).toEqual({ tags: ["paid"] });

  await page.getByRole("button", { name: "Edit URL" }).click();
  await page.getByRole("textbox", { name: "URL" }).fill("https://example.com/new-menu");
  await page.getByRole("button", { name: "Save URL" }).click();
  await expect.poll(() => dynamicUpdateRequest).toEqual({
    destinationUrl: "https://example.com/new-menu",
    existingLinkId: "dynamic-menu",
    slug: "menu",
    trackStatistics: true,
    useDynamicUrl: true,
  });

  await page.getByRole("button", { name: "View Stats" }).click();
  await expect(page.getByRole("dialog", { name: "View Stats" })).toContainText(
    "Total Scans",
  );
  await expect(page.getByRole("dialog", { name: "View Stats" })).toContainText(
    "2",
  );
});

test("unwatermarked purchase redirects to credits when balance is empty", async ({
  page,
}) => {
  await routeSavedPrintFixtures(page, { balance: 0 });

  await page.goto("/print-labels?saved=saved-print");
  await expect(page.getByText("Saved print link")).toBeVisible();

  await page
    .getByTestId("label-template-purchase-button-avery-presta-94100")
    .click();

  await expect(page).toHaveURL(/\/credits\?needCredits=1&returnTo=/);
  await expect(
    page.getByText("Purchase credits before creating an unwatermarked PDF."),
  ).toBeVisible();
});

test("anchors PDF header and footer to fixed page margins", async ({ page }) => {
  const capturedPurchases: CapturedPdfPurchase[] = [];

  await page.addInitScript(() => {
    window.open = () =>
      ({
        close() {},
        location: { href: "" },
      }) as Window;
  });
  await routeSavedPrintFixtures(page, { balance: 25 });
  await routePdfPurchaseCapture(page, capturedPurchases);

  await page.goto("/print-labels?saved=saved-print");
  await expect(page.getByText("Saved print link")).toBeVisible();

  await page.getByRole("radio", { name: "Rectangle" }).click();
  const rectanglePurchase = await purchaseTemplatePdf(
    page,
    capturedPurchases,
    "avery-presta-94256",
  );

  await page.getByRole("radio", { name: "Circle" }).click();
  const circlePurchase = await purchaseTemplatePdf(
    page,
    capturedPurchases,
    "avery-presta-94514",
  );

  await page.getByRole("radio", { name: "Jumbo" }).click();
  const fullSheetJumboPurchase = await purchaseTemplatePdf(
    page,
    capturedPurchases,
    "avery-presta-94268",
  );

  const rectangleChrome = getPdfChromeTextPositions(rectanglePurchase.pdfBase64);
  const circleChrome = getPdfChromeTextPositions(circlePurchase.pdfBase64);
  const fullSheetJumboChrome = getPdfChromeTextPositions(
    fullSheetJumboPurchase.pdfBase64,
  );

  expect(rectangleChrome.header).toBeDefined();
  expect(rectangleChrome.footer).toBeDefined();
  expect(circleChrome.header).toBeDefined();
  expect(circleChrome.footer).toBeDefined();
  expect(rectangleChrome.header!.y).toBeCloseTo(circleChrome.header!.y, 4);
  expect(rectangleChrome.footer!.y).toBeCloseTo(circleChrome.footer!.y, 4);
  expect(792 - rectangleChrome.header!.y).toBeLessThan(36);
  expect(792 - rectangleChrome.header!.y).toBeGreaterThan(20);
  expect(rectangleChrome.footer!.y).toBeGreaterThan(12);
  expect(rectangleChrome.footer!.y).toBeLessThan(28);
  expect(fullSheetJumboChrome.header).toBeUndefined();
  expect(fullSheetJumboChrome.footer).toBeUndefined();
});

test("expands circle shaped QR artwork to fit circular labels", async ({
  page,
}) => {
  await routeSavedPrintFixtures(page, { qrCode: circleSavedQrCode });

  await page.goto("/print-labels?saved=saved-circle");
  await expect(page.getByText("Circle saved print link")).toBeVisible();

  await expect(page.getByRole("radio", { name: "Circle" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94514"),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Square" }).click();
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94100"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94101"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94107"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94106"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94103"),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "Circle" }).click();

  const largeCirclePreview = await page
    .getByTestId("label-template-preview-avery-presta-94514")
    .boundingBox();
  const largeCircleArtwork = await page
    .getByTestId("label-template-artwork-avery-presta-94514")
    .boundingBox();
  const largeCirclePreviewBorder = await page
    .getByTestId("label-template-preview-border-avery-presta-94514")
    .boundingBox();
  const previewLayering = await page
    .getByTestId("label-template-preview-avery-presta-94514")
    .evaluate((preview) => {
      const artwork = preview.querySelector(
        '[data-testid="label-template-artwork-avery-presta-94514"]',
      );
      const border = preview.querySelector(
        '[data-testid="label-template-preview-border-avery-presta-94514"]',
      );

      return {
        artworkBeforeBorder: Boolean(
          artwork &&
            border &&
            (artwork.compareDocumentPosition(border) &
              Node.DOCUMENT_POSITION_FOLLOWING) !==
              0,
        ),
        borderZIndex: border ? getComputedStyle(border).zIndex : "",
      };
    });

  expect(largeCirclePreview).not.toBeNull();
  expect(largeCircleArtwork).not.toBeNull();
  expect(largeCirclePreviewBorder).not.toBeNull();
  expect(largeCirclePreview!.width).toBeCloseTo(336, 0);
  expect(largeCirclePreview!.height).toBeCloseTo(336, 0);
  expect(largeCircleArtwork!.width).toBeCloseTo(312, 0);
  expect(largeCircleArtwork!.height).toBeCloseTo(312, 0);
  expect(largeCirclePreviewBorder!.width).toBeCloseTo(
    largeCirclePreview!.width,
    0,
  );
  expect(largeCirclePreviewBorder!.height).toBeCloseTo(
    largeCirclePreview!.height,
    0,
  );
  expect(previewLayering).toEqual({
    artworkBeforeBorder: true,
    borderZIndex: "10",
  });
  expect(largeCircleArtwork!.width).toBeGreaterThan(
    largeCirclePreview!.width / Math.SQRT2,
  );
});

test("expands circle shaped QR artwork from the builder to fit circular labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(
    () => "_value" in document.querySelector('input[type="url"]'),
  );
  await page
    .locator('input[type="url"]')
    .fill("https://example.com/circle-print-builder");

  await page.getByRole("button", { name: "Shape" }).click();
  await page.getByRole("radio", { name: "Circle" }).click();
  await page.getByRole("button", { exact: true, name: "Border" }).click();
  await page.getByRole("radio", { name: "Medium" }).click();
  await page.getByRole("button", { exact: true, name: "Print to Labels" }).click();
  await page.waitForURL("**/print-labels");

  const payloadShape = await page.evaluate((storageKey) => {
    const rawPayload = sessionStorage.getItem(storageKey);

    return rawPayload ? JSON.parse(rawPayload).qrShape : null;
  }, labelPrintPayloadStorageKey);

  expect(payloadShape).toBe("circle");

  await page.getByRole("radio", { name: "Circle" }).click();

  const largeCircleArtwork = await page
    .getByTestId("label-template-artwork-avery-presta-94514")
    .boundingBox();

  expect(largeCircleArtwork).not.toBeNull();
  expect(largeCircleArtwork!.width).toBeCloseTo(312, 0);
  expect(largeCircleArtwork!.height).toBeCloseTo(312, 0);
});

test("suggests rectangle labels closest to the QR aspect ratio", async ({
  page,
}) => {
  await routeSavedPrintFixtures(page, { qrCode: tallSavedQrCode });

  await page.goto("/print-labels?saved=saved-tall");
  await expect(page.getByText("Tall saved print link")).toBeVisible();

  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94256"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94237"),
  ).toBeVisible();
  await expect(
    page.getByTestId("label-template-suggested-badge-avery-presta-94207"),
  ).toHaveCount(0);
});

test("rotates preview label outline for tall QR labels that print sideways", async ({
  page,
}) => {
  await routeSavedPrintFixtures(page, { qrCode: tallSavedQrCode });

  await page.goto("/print-labels?saved=saved-tall");
  await expect(page.getByText("Tall saved print link")).toBeVisible();

  const tallOnPortraitTransform = await page
    .getByTestId("label-template-artwork-avery-presta-94256")
    .locator("img")
    .evaluate((element) => (element as HTMLElement).style.transform);
  const tallOnLandscapeTransform = await page
    .getByTestId("label-template-artwork-avery-presta-94207")
    .locator("img")
    .evaluate((element) => (element as HTMLElement).style.transform);
  const tallOnLandscapePreview = await page
    .getByTestId("label-template-preview-avery-presta-94207")
    .boundingBox();
  const tallOnLandscapeArtwork = await page
    .getByTestId("label-template-artwork-avery-presta-94207")
    .boundingBox();

  expect(tallOnLandscapePreview).not.toBeNull();
  expect(tallOnLandscapeArtwork).not.toBeNull();
  expect(tallOnPortraitTransform).not.toContain("rotate");
  expect(tallOnLandscapeTransform).not.toContain("rotate");
  expect(tallOnLandscapePreview!.height).toBeGreaterThan(
    tallOnLandscapePreview!.width,
  );
  expect(tallOnLandscapeArtwork!.height).toBeGreaterThan(
    tallOnLandscapeArtwork!.width,
  );
  await expect(
    page.getByTestId("label-template-preview-width-avery-presta-94207"),
  ).toHaveText('2"');
  await expect(
    page.getByTestId("label-template-preview-height-avery-presta-94207"),
  ).toHaveText('4"');
});

test("rotates preview label outline differently for wide QR labels", async ({
  page,
}) => {
  await routeSavedPrintFixtures(page, { qrCode: wideSavedQrCode });

  await page.goto("/print-labels?saved=saved-wide");
  await expect(page.getByText("Wide saved print link")).toBeVisible();

  const wideOnPortraitTransform = await page
    .getByTestId("label-template-artwork-avery-presta-94256")
    .locator("img")
    .evaluate((element) => (element as HTMLElement).style.transform);
  const wideOnLandscapeTransform = await page
    .getByTestId("label-template-artwork-avery-presta-94207")
    .locator("img")
    .evaluate((element) => (element as HTMLElement).style.transform);
  const wideOnPortraitPreview = await page
    .getByTestId("label-template-preview-avery-presta-94256")
    .boundingBox();
  const wideOnPortraitArtwork = await page
    .getByTestId("label-template-artwork-avery-presta-94256")
    .boundingBox();

  expect(wideOnPortraitPreview).not.toBeNull();
  expect(wideOnPortraitArtwork).not.toBeNull();
  expect(wideOnPortraitTransform).not.toContain("rotate");
  expect(wideOnLandscapeTransform).not.toContain("rotate");
  expect(wideOnPortraitPreview!.width).toBeGreaterThan(
    wideOnPortraitPreview!.height,
  );
  expect(wideOnPortraitArtwork!.width).toBeGreaterThan(
    wideOnPortraitArtwork!.height,
  );
});

function getPdfChromeTextPositions(pdfBase64: string) {
  const streams = getInflatedPdfStreams(pdfBase64);

  return {
    footer: findPdfTextPosition(streams, "Template size:"),
    header: findPdfTextPosition(streams, "QR Codes On Labels"),
  };
}

function getInflatedPdfStreams(pdfBase64: string) {
  const pdfText = Buffer.from(pdfBase64, "base64").toString("latin1");
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const streams: string[] = [];

  for (
    let match = streamPattern.exec(pdfText);
    match;
    match = streamPattern.exec(pdfText)
  ) {
    try {
      streams.push(
        inflateSync(Buffer.from(match[1]!, "latin1")).toString("latin1"),
      );
    } catch {
      // Some PDF streams are not Flate-compressed content streams.
    }
  }

  return streams;
}

function findPdfTextPosition(streams: string[], textNeedle: string) {
  const textPattern =
    /1 0 0 1\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm\s*<([0-9A-Fa-f]+)>\s*Tj/g;

  for (const stream of streams) {
    for (
      let match = textPattern.exec(stream);
      match;
      match = textPattern.exec(stream)
    ) {
      const text = Buffer.from(match[3]!, "hex").toString("latin1");

      if (text.includes(textNeedle)) {
        return {
          text,
          x: Number(match[1]),
          y: Number(match[2]),
        };
      }
    }
  }

  return undefined;
}
