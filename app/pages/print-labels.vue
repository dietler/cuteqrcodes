<script setup lang="ts">
import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { computed, onMounted, ref } from "vue";
import type { CreditsSummary, PurchasedPdf } from "~/utils/credits";
import type { DynamicQrLinkPayload } from "~/utils/dynamic-qr";
import {
  createLabelPrintPayloadFromSavedQr,
  getLabelArtworkPlacement,
  getSuggestedLabelTemplateIds,
  labelPdfRenderLongEdgePixels,
  labelPrintPayloadStorageKey,
  labelTemplates,
  type LabelTemplate,
  type LabelTemplateType,
  type LabelPrintPayload,
} from "~/utils/label-print";
import type { SavedQrCode } from "~/utils/saved-qr";
import { embedUsedSvgFontFacesInText } from "~/utils/svg-export";
import { useSession } from "~~/lib/auth-client";

type LabelType = LabelTemplateType;
type LabelSortOrder = "largest-to-smallest" | "smallest-to-largest";

const selectedLabelType = ref<LabelType>("rectangle");
const selectedLabelSortOrder = ref<LabelSortOrder>("largest-to-smallest");
const printPayload = ref<LabelPrintPayload | null>(null);
const session = useSession();
const creditBalance = ref<number | null>(null);
const didAutoSelectLabelType = ref(false);
const isLoadingPrintPayload = ref(false);
const activePdfAction = ref("");
const pdfError = ref("");
const route = useRoute();
const pdfChromeMargin = 18;
const pdfHeaderFontSize = 8;
const pdfFooterFontSize = 7;
const pdfChromeHorizontalPadding = 24;

const labelTypeOptions: { label: string; value: LabelType }[] = [
  { label: "Rectangle", value: "rectangle" },
  { label: "Square", value: "square" },
  { label: "Circle", value: "circle" },
  { label: "Jumbo", value: "jumbo" },
];
const labelSortOrderOptions: { label: string; value: LabelSortOrder }[] = [
  { label: "Largest to Smallest", value: "largest-to-smallest" },
  { label: "Smallest to Largest", value: "smallest-to-largest" },
];

const hasPrintPayload = computed(() => Boolean(printPayload.value));
const isCreatingPdf = computed(() => Boolean(activePdfAction.value));
const dynamicLinkPurchaseCost = computed(() =>
  getDynamicLinkPurchaseCost(printPayload.value?.dynamicLink),
);
const printablePdfPurchaseCost = computed(
  () => 1 + dynamicLinkPurchaseCost.value,
);
const dynamicLinkPurchaseLabel = computed(() =>
  getDynamicLinkPurchaseLabel(printPayload.value?.dynamicLink),
);
const activeLabelTemplates = computed(() =>
  labelTemplates
    .filter((template) => template.type === selectedLabelType.value)
    .toSorted(compareLabelTemplatesBySelectedSortOrder),
);
const printPayloadSvgDataUrl = computed(() =>
  printPayload.value ? createSvgDataUrl(printPayload.value.svg) : "",
);
const suggestedLabelTemplateIds = computed(
  () =>
    new Set(
      printPayload.value
        ? getSuggestedLabelTemplateIds(printPayload.value)
        : [],
    ),
);
const suggestedLabelTypes = computed(
  () =>
    new Set(
      labelTemplates
        .filter((template) => suggestedLabelTemplateIds.value.has(template.id))
        .map((template) => template.type),
    ),
);

onMounted(() => {
  void loadPrintPayload();
  void loadCreditBalance({ silent: true });
});

function selectLabelType(value: LabelType) {
  didAutoSelectLabelType.value = true;
  selectedLabelType.value = value;
  pdfError.value = "";
}

function compareLabelTemplatesBySelectedSortOrder(
  first: LabelTemplate,
  second: LabelTemplate,
) {
  const firstArea = getLabelTemplateArea(first);
  const secondArea = getLabelTemplateArea(second);

  return selectedLabelSortOrder.value === "largest-to-smallest"
    ? secondArea - firstArea
    : firstArea - secondArea;
}

function getLabelTemplateArea(template: LabelTemplate) {
  return template.layout.labelWidth * template.layout.labelHeight;
}

function applySuggestedLabelType() {
  if (didAutoSelectLabelType.value || !suggestedLabelTemplateIds.value.size) {
    return;
  }

  const firstSuggestedTemplate = labelTemplates.find((template) =>
    suggestedLabelTemplateIds.value.has(template.id),
  );

  if (firstSuggestedTemplate) {
    selectedLabelType.value = firstSuggestedTemplate.type;
    didAutoSelectLabelType.value = true;
  }
}

function getActionId(action: "preview" | "purchase", template: LabelTemplate) {
  return `${action}:${template.id}`;
}

function isTemplateActionLoading(
  action: "preview" | "purchase",
  template: LabelTemplate,
) {
  return activePdfAction.value === getActionId(action, template);
}

function getDynamicLinkPurchaseCost(dynamicLink: DynamicQrLinkPayload | undefined) {
  if (!dynamicLink || dynamicLink.id) {
    return 0;
  }

  return Number(dynamicLink.useDynamicUrl) + Number(dynamicLink.trackStatistics);
}

function getDynamicLinkPurchaseLabel(dynamicLink: DynamicQrLinkPayload | undefined) {
  if (!dynamicLink || dynamicLink.id) {
    return "";
  }

  if (dynamicLink.useDynamicUrl && dynamicLink.trackStatistics) {
    return "Create Editable Link & Track Stats";
  }

  return dynamicLink.useDynamicUrl ? "Create Editable Link" : "Track Stats";
}

function getPurchaseCreditsQueryValue() {
  return String(printablePdfPurchaseCost.value);
}

function isSuggestedLabelTemplate(template: LabelTemplate) {
  return suggestedLabelTemplateIds.value.has(template.id);
}

function isSuggestedLabelType(value: LabelType) {
  return suggestedLabelTypes.value.has(value);
}

function getAveryTemplateUrl(template: LabelTemplate) {
  return `https://www.avery.com/blank/labels/${template.templateNumber}`;
}

function getAmazonTemplateUrl(template: LabelTemplate) {
  return `https://www.amazon.com/s?k=avery+${template.templateNumber}`;
}

function getLabelPreviewAlt(template: LabelTemplate) {
  const title = printPayload.value?.title || "QR code";

  return `${title} printed on ${template.description}`;
}

function getLabelPreviewStyle(template: LabelTemplate) {
  const { height, width } = getLabelPreviewDimensions(template);

  return {
    height: `${pointsToInches(height)}in`,
    width: `${pointsToInches(width)}in`,
  };
}

function getLabelPreviewClass(template: LabelTemplate) {
  return template.type === "circle" ? "rounded-full" : "";
}

function getLabelPreviewDimensions(template: LabelTemplate) {
  const artworkPlacement = getLabelPreviewArtworkPlacement(template);

  return {
    height: artworkPlacement.rotate
      ? template.layout.labelWidth
      : template.layout.labelHeight,
    width: artworkPlacement.rotate
      ? template.layout.labelHeight
      : template.layout.labelWidth,
  };
}

function getLabelPreviewDimensionLabels(template: LabelTemplate) {
  const artworkPlacement = getLabelPreviewArtworkPlacement(template);
  const { height, width } = getLabelTemplateDimensionLabels(template);

  return {
    bottom: artworkPlacement.rotate ? height : width,
    right: artworkPlacement.rotate ? width : height,
  };
}

function getLabelTemplateDimensionLabels(template: LabelTemplate) {
  const [first, second] =
    template.label.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  if (Number.isFinite(first) && Number.isFinite(second)) {
    const layoutWidth = pointsToInches(template.layout.labelWidth);
    const layoutHeight = pointsToInches(template.layout.labelHeight);
    const listedOrderScore =
      Math.abs(first! - layoutWidth) + Math.abs(second! - layoutHeight);
    const swappedOrderScore =
      Math.abs(second! - layoutWidth) + Math.abs(first! - layoutHeight);

    if (listedOrderScore <= swappedOrderScore) {
      return {
        height: formatInches(second!),
        width: formatInches(first!),
      };
    }

    return {
      height: formatInches(first!),
      width: formatInches(second!),
    };
  }

  return {
    height: formatInches(pointsToInches(template.layout.labelHeight)),
    width: formatInches(pointsToInches(template.layout.labelWidth)),
  };
}

function getLabelPreviewArtworkFrameStyle(template: LabelTemplate) {
  const artworkPlacement = getLabelPreviewArtworkPlacement(template);
  const width = artworkPlacement.rotate
    ? artworkPlacement.height
    : artworkPlacement.width;
  const height = artworkPlacement.rotate
    ? artworkPlacement.width
    : artworkPlacement.height;

  return {
    height: `${pointsToInches(height)}in`,
    width: `${pointsToInches(width)}in`,
  };
}

function getLabelPreviewArtworkImageStyle() {
  return {
    height: "100%",
    transform: "translate(-50%, -50%)",
    width: "100%",
  };
}

function getLabelPreviewArtworkPlacement(template: LabelTemplate) {
  const payload = printPayload.value;

  if (!payload) {
    return {
      height: 0,
      rotate: false,
      scale: 0,
      width: 0,
    };
  }

  return getLabelArtworkPlacement(payload, template);
}

function pointsToInches(points: number) {
  return points / pdfPointsPerInch;
}

function formatInches(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}"`;
}

function createSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function readPrintPayload() {
  const rawPayload = sessionStorage.getItem(labelPrintPayloadStorageKey);

  if (!rawPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(rawPayload) as Partial<LabelPrintPayload>;

    if (
      typeof payload.svg !== "string" ||
      typeof payload.title !== "string" ||
      !Number.isFinite(payload.width) ||
      !Number.isFinite(payload.height) ||
      typeof payload.createdAt !== "number"
    ) {
      return null;
    }

    if (typeof payload.name !== "string") {
      delete payload.name;
    }

    if (payload.qrShape !== "circle") {
      payload.qrShape = "rectangle";
    }

    if (typeof payload.url !== "string") {
      delete payload.url;
    }

    if (!isDynamicLinkPayload(payload.dynamicLink)) {
      delete payload.dynamicLink;
    }

    return payload as LabelPrintPayload;
  } catch {
    return null;
  }
}

function isDynamicLinkPayload(value: unknown): value is DynamicQrLinkPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<DynamicQrLinkPayload>;

  return (
    typeof payload.destinationUrl === "string" &&
    typeof payload.id === "string" &&
    typeof payload.redirectUrl === "string" &&
    typeof payload.slug === "string" &&
    typeof payload.trackStatistics === "boolean" &&
    typeof payload.useDynamicUrl === "boolean"
  );
}

async function loadPrintPayload() {
  const storedPayload = await preparePrintPayloadForImageRendering(
    readPrintPayload(),
  );
  const savedQrCodeId =
    typeof route.query.saved === "string" ? route.query.saved : "";

  printPayload.value = storedPayload;

  if (storedPayload) {
    sessionStorage.setItem(
      labelPrintPayloadStorageKey,
      JSON.stringify(storedPayload),
    );
  }

  if (!savedQrCodeId) {
    applySuggestedLabelType();
    return;
  }

  isLoadingPrintPayload.value = true;

  try {
    const response = await $fetch<{ qrCode: SavedQrCode }>(
      `/api/qr/saved/${encodeURIComponent(savedQrCodeId)}`,
    );

    printPayload.value = await preparePrintPayloadForImageRendering(
      createLabelPrintPayloadFromSavedQr(response.qrCode),
    );
    sessionStorage.setItem(
      labelPrintPayloadStorageKey,
      JSON.stringify(printPayload.value),
    );
    applySuggestedLabelType();
  } catch (error) {
    applySuggestedLabelType();

    if (!storedPayload) {
      pdfError.value = getErrorMessage(
        error,
        "Unable to load the saved QR code for labels.",
      );
    }
  } finally {
    isLoadingPrintPayload.value = false;
  }
}

async function preparePrintPayloadForImageRendering(
  payload: LabelPrintPayload | null,
) {
  if (!payload) {
    return null;
  }

  try {
    const svg = await embedUsedSvgFontFacesInText(payload.svg);

    return svg === payload.svg ? payload : { ...payload, svg };
  } catch {
    return payload;
  }
}

async function loadCreditBalance({
  silent = false,
}: { silent?: boolean } = {}) {
  try {
    const response = await $fetch<CreditsSummary>("/api/credits/summary");

    creditBalance.value = response.balance;
  } catch (error) {
    creditBalance.value = null;

    if (!silent) {
      pdfError.value = getErrorMessage(error, "Unable to load credits.");
    }
  }
}

async function previewLabelPdf(template: LabelTemplate) {
  const payload = printPayload.value;

  if (!payload || isCreatingPdf.value) {
    return;
  }

  const pdfWindow = window.open("", "_blank");
  const actionId = getActionId("preview", template);

  activePdfAction.value = actionId;
  pdfError.value = "";

  try {
    openPdfBytes(
      await createLabelPdfBytes(template, { watermark: true }),
      pdfWindow,
    );
  } catch (error) {
    pdfWindow?.close();
    pdfError.value = getErrorMessage(
      error,
      "Unable to create the label PDF preview.",
    );
  } finally {
    if (activePdfAction.value === actionId) {
      activePdfAction.value = "";
    }
  }
}

async function purchaseLabelPdf(template: LabelTemplate) {
  const payload = printPayload.value;

  if (!payload || isCreatingPdf.value) {
    return;
  }

  if (!session.value.data?.user) {
    await navigateTo({
      path: "/credits",
      query: {
        needCredits: getPurchaseCreditsQueryValue(),
        returnTo: route.fullPath,
      },
    });
    return;
  }

  let balance = creditBalance.value;

  if (balance === null) {
    await loadCreditBalance();
    balance = creditBalance.value;
  }

  if (balance === null || balance < printablePdfPurchaseCost.value) {
    await navigateTo({
      path: "/credits",
      query: {
        needCredits: getPurchaseCreditsQueryValue(),
        returnTo: route.fullPath,
      },
    });
    return;
  }

  const pdfWindow = window.open("", "_blank");
  const actionId = getActionId("purchase", template);

  activePdfAction.value = actionId;
  pdfError.value = "";

  try {
    const pdfBytes = await createLabelPdfBytes(template, { watermark: false });
    const response = await $fetch<{
      balance: number;
      dynamicLink?: DynamicQrLinkPayload;
      pdf: PurchasedPdf;
    }>("/api/credits/pdf-purchases", {
      body: {
        dynamicLink: payload.dynamicLink,
        pdfBase64: uint8ArrayToBase64(pdfBytes),
        qrTitle: payload.name || payload.title,
        templateId: template.id,
      },
      method: "POST",
    });

    creditBalance.value = response.balance;
    if (response.dynamicLink) {
      printPayload.value = {
        ...payload,
        dynamicLink: response.dynamicLink,
        title: response.dynamicLink.redirectUrl,
        url: response.dynamicLink.redirectUrl,
      };
      sessionStorage.setItem(
        labelPrintPayloadStorageKey,
        JSON.stringify(printPayload.value),
      );
    }
    openPurchasedPdf(response.pdf.downloadUrl, pdfWindow);
  } catch (error) {
    pdfWindow?.close();

    if (getErrorStatusCode(error) === 402) {
      await navigateTo({
        path: "/credits",
        query: {
          needCredits: getPurchaseCreditsQueryValue(),
          returnTo: route.fullPath,
        },
      });
      return;
    }

    pdfError.value = getErrorMessage(
      error,
      "Unable to purchase the label PDF.",
    );
  } finally {
    if (activePdfAction.value === actionId) {
      activePdfAction.value = "";
    }
  }
}

async function createLabelPdfBytes(
  template: LabelTemplate,
  { watermark }: { watermark: boolean },
) {
  const payload = printPayload.value;

  if (!payload) {
    throw new Error("No QR code is ready for labels.");
  }

  await document.fonts?.ready;

  const { layout } = template;
  const artworkPlacement = getLabelArtworkPlacement(payload, template);
  const qrPngDataUrl = await renderPayloadToPng(
    payload,
    artworkPlacement.rotate,
  );
  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([layout.pageWidth, layout.pageHeight]);
  const qrImage = await pdfDocument.embedPng(qrPngDataUrl);
  const headerLogoImage = await pdfDocument.embedPng(
    await renderSvgAssetToPng("/icons/qr-code.svg", 96, 96),
  );
  const headerBoldFont = await pdfDocument.embedFont(
    StandardFonts.HelveticaBold,
  );
  const footerFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const labelsPerSheet = layout.columns * layout.rows;
  const imageWidth = artworkPlacement.width;
  const imageHeight = artworkPlacement.height;

  if (shouldDrawPdfChrome(template)) {
    drawPdfHeader(page, {
      logoImage: headerLogoImage,
      name: payload.name || payload.title,
      pageHeight: layout.pageHeight,
      pageWidth: layout.pageWidth,
      url: payload.url || payload.title,
      boldFont: headerBoldFont,
    });
  }

  for (let index = 0; index < labelsPerSheet; index++) {
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const labelX =
      layout.marginLeft + column * (layout.labelWidth + layout.columnGap);
    const labelTopY =
      layout.marginTop + row * (layout.labelHeight + layout.rowGap);
    const labelY = layout.pageHeight - labelTopY - layout.labelHeight;

    page.drawImage(qrImage, {
      x: labelX + (layout.labelWidth - imageWidth) / 2,
      y: labelY + (layout.labelHeight - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
    });
  }

  if (watermark) {
    drawPdfWatermark(page, {
      boldFont: headerBoldFont,
      logoImage: headerLogoImage,
      pageHeight: layout.pageHeight,
      pageWidth: layout.pageWidth,
    });
  }

  if (shouldDrawPdfChrome(template)) {
    drawPdfFooter(page, {
      font: footerFont,
      pageWidth: layout.pageWidth,
      template,
    });
  }

  return pdfDocument.save();
}

function shouldDrawPdfChrome(template: LabelTemplate) {
  return !isFullSheetJumboTemplate(template);
}

function isFullSheetJumboTemplate(template: LabelTemplate) {
  const { layout } = template;

  return (
    template.type === "jumbo" &&
    layout.columns === 1 &&
    layout.rows === 1 &&
    Math.abs(layout.labelWidth - layout.pageWidth) < 0.01 &&
    Math.abs(layout.labelHeight - layout.pageHeight) < 0.01
  );
}

function drawPdfHeader(
  page: PDFPage,
  {
    boldFont,
    logoImage,
    name,
    pageHeight,
    pageWidth,
    url,
  }: {
    boldFont: PDFFont;
    logoImage: PDFImage;
    name: string;
    pageHeight: number;
    pageWidth: number;
    url: string;
  },
) {
  const logoSize = pdfHeaderFontSize * 2;
  const headerTop = pageHeight - pdfChromeMargin;
  const logoY = headerTop - logoSize;
  const textX = pdfChromeHorizontalPadding + logoSize + 8;
  const maxTextWidth = pageWidth - textX - pdfChromeHorizontalPadding;
  const textY = headerTop - logoSize / 2 - pdfHeaderFontSize / 2;
  const headerText = ["QR Codes On Labels", name, url]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" - ");

  page.drawImage(logoImage, {
    height: logoSize,
    width: logoSize,
    x: pdfChromeHorizontalPadding,
    y: logoY,
  });
  page.drawText(
    truncatePdfText(boldFont, headerText, pdfHeaderFontSize, maxTextWidth),
    {
      color: rgb(0.07, 0.08, 0.1),
      font: boldFont,
      size: pdfHeaderFontSize,
      x: textX,
      y: textY,
    },
  );
}

function drawPdfFooter(
  page: PDFPage,
  {
    font,
    pageWidth,
    template,
  }: {
    font: PDFFont;
    pageWidth: number;
    template: LabelTemplate;
  },
) {
  const maxTextWidth = pageWidth - pdfChromeHorizontalPadding * 2;
  const footerText = `Template size: ${template.label} - ${template.description}`;
  const text = truncatePdfText(font, footerText, pdfFooterFontSize, maxTextWidth);
  const textWidth = font.widthOfTextAtSize(text, pdfFooterFontSize);

  page.drawText(text, {
    color: rgb(0.39, 0.45, 0.54),
    font,
    size: pdfFooterFontSize,
    x: Math.max(pdfChromeHorizontalPadding, (pageWidth - textWidth) / 2),
    y: pdfChromeMargin,
  });
}

function drawPdfWatermark(
  page: PDFPage,
  {
    boldFont,
    logoImage,
    pageHeight,
    pageWidth,
  }: {
    boldFont: PDFFont;
    logoImage: PDFImage;
    pageHeight: number;
    pageWidth: number;
  },
) {
  const text = "QR Codes On Labels";
  const textSize = 18;
  const logoSize = 28;
  const watermarkOpacity = 0.34;
  const stepX = 144;
  const stepY = 96;

  for (let y = -stepY; y < pageHeight + stepY; y += stepY) {
    for (let x = -stepX; x < pageWidth + stepX; x += stepX) {
      page.drawImage(logoImage, {
        height: logoSize,
        opacity: watermarkOpacity,
        rotate: degrees(-25),
        width: logoSize,
        x,
        y,
      });
      page.drawText(text, {
        color: rgb(0.08, 0.09, 0.11),
        font: boldFont,
        opacity: watermarkOpacity,
        rotate: degrees(-25),
        size: textSize,
        x: x + logoSize + 6,
        y,
      });
    }
  }
}

function openPdfBytes(pdfBytes: Uint8Array, pdfWindow: Window | null) {
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);

  new Uint8Array(pdfBuffer).set(pdfBytes);

  const pdfUrl = URL.createObjectURL(
    new Blob([pdfBuffer], { type: "application/pdf" }),
  );

  if (pdfWindow) {
    pdfWindow.location.href = pdfUrl;
  } else {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }

  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
}

function openPurchasedPdf(downloadUrl: string, pdfWindow: Window | null) {
  if (pdfWindow) {
    pdfWindow.location.href = downloadUrl;
    return;
  }

  const link = document.createElement("a");

  link.href = downloadUrl;
  link.target = "_blank";
  link.rel = "noopener";
  link.click();
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function truncatePdfText(
  font: PDFFont,
  value: string,
  fontSize: number,
  maxWidth: number,
) {
  const text = value.trim();

  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
    return text;
  }

  const ellipsis = "...";
  let low = 0;
  let high = text.length;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, middle)}${ellipsis}`;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return `${text.slice(0, low)}${ellipsis}`;
}

async function renderSvgAssetToPng(src: string, width: number, height: number) {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error("Unable to load the PDF header logo.");
  }

  const svg = await response.text();
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
  const canvas = document.createElement("canvas");
  const scale = 3;

  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas rendering is not available.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/png");
}

async function renderPayloadToPng(
  payload: LabelPrintPayload,
  rotateArtwork: boolean,
) {
  const svgImage = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(payload.svg)}`,
  );
  const renderScale =
    labelPdfRenderLongEdgePixels / Math.max(payload.width, payload.height);
  const renderedWidth = Math.ceil(payload.width * renderScale);
  const renderedHeight = Math.ceil(payload.height * renderScale);
  const canvas = document.createElement("canvas");

  canvas.width = rotateArtwork ? renderedHeight : renderedWidth;
  canvas.height = rotateArtwork ? renderedWidth : renderedHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas rendering is not available.");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (rotateArtwork) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  }

  context.drawImage(svgImage, 0, 0, renderedWidth, renderedHeight);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Unable to render QR artwork for PDF.")),
    );
    image.src = src;
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (
      error as { data?: { message?: string; statusMessage?: string } }
    ).data;
    const message = data?.statusMessage || data?.message;

    if (message) {
      return message;
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function getErrorStatusCode(error: unknown) {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    return Number((error as { statusCode?: unknown }).statusCode);
  }

  if (typeof error === "object" && error !== null && "data" in error) {
    return Number(
      (error as { data?: { statusCode?: unknown } }).data?.statusCode,
    );
  }

  return 0;
}
</script>

<template>
  <UContainer
    class="flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col gap-4 py-4 sm:gap-6 sm:py-6"
    data-testid="print-labels-page"
  >
    <div class="flex items-center justify-between gap-3">
      <UButton
        color="neutral"
        icon="i-lucide-arrow-left"
        variant="subtle"
        @click="navigateTo('/')"
      >
        QR Code
      </UButton>
    </div>

    <UCard>
      <div class="space-y-5">
        <div>
          <h1 class="text-lg font-semibold text-highlighted">
            Print to Labels
          </h1>
          <p v-if="printPayload" class="mt-1 truncate text-sm text-muted">
            {{ printPayload.title }}
          </p>
        </div>

        <UAlert
          v-if="isLoadingPrintPayload"
          color="neutral"
          icon="i-lucide-loader-circle"
          title="Loading saved QR code..."
          variant="subtle"
        />
        <UAlert
          v-else-if="!hasPrintPayload"
          color="warning"
          icon="i-lucide-triangle-alert"
          title="No QR code is ready for labels."
          variant="subtle"
        />
        <UAlert
          v-if="pdfError"
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="pdfError"
          variant="subtle"
        />

        <template v-if="hasPrintPayload">
          <div
            class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end"
          >
            <UFormField label="Label Type">
              <div
                aria-label="Label Type"
                class="flex flex-wrap gap-2"
                role="radiogroup"
              >
                <button
                  v-for="option in labelTypeOptions"
                  :key="option.value"
                  :aria-checked="selectedLabelType === option.value"
                  class="rounded-lg border px-3 py-2 text-sm font-medium transition"
                  :class="
                    selectedLabelType === option.value
                      ? 'border-primary bg-primary text-inverted'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'
                  "
                  role="radio"
                  type="button"
                  @click="selectLabelType(option.value)"
                >
                  <span class="inline-flex items-center gap-2">
                    <span>{{ option.label }}</span>
                    <UBadge
                      v-if="isSuggestedLabelType(option.value)"
                      :class="
                        selectedLabelType === option.value
                          ? '!bg-white !text-primary !ring-white/80 dark:!bg-white dark:!text-primary'
                          : ''
                      "
                      color="primary"
                      size="sm"
                      variant="subtle"
                    >
                      Suggested
                    </UBadge>
                  </span>
                </button>
              </div>
            </UFormField>

            <UFormField label="Sort By">
              <USelect
                v-model="selectedLabelSortOrder"
                class="w-full"
                :items="labelSortOrderOptions"
                size="lg"
              />
            </UFormField>
          </div>

          <div
            class="mx-auto grid w-full max-w-5xl gap-3"
            data-testid="label-template-grid"
          >
            <div
              v-for="template in activeLabelTemplates"
              :key="template.id"
              class="min-w-0 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              :data-testid="`label-template-card-${template.id}`"
            >
              <div class="min-w-0 space-y-4">
                <div class="text-center">
                  <div
                    class="flex flex-wrap items-center justify-center gap-2 text-lg font-semibold text-highlighted"
                  >
                    <span>{{ template.label }}</span>
                    <UBadge
                      v-if="isSuggestedLabelTemplate(template)"
                      color="primary"
                      :data-testid="`label-template-suggested-badge-${template.id}`"
                      size="sm"
                      variant="subtle"
                    >
                      Suggested Size
                    </UBadge>
                  </div>
                  <div class="mt-1 text-sm text-muted">
                    {{ template.description }}
                  </div>
                </div>

                <div
                  :aria-label="`${template.description} label preview`"
                  class="-mx-1 min-w-0 overflow-auto px-1 pb-6 pr-8 [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch] sm:mx-0 sm:px-8 sm:pb-6"
                  :data-testid="`label-template-preview-scroll-${template.id}`"
                  tabindex="0"
                >
                  <div class="relative mx-auto w-max">
                    <div
                      class="relative box-border flex shrink-0 items-center justify-center border border-transparent bg-white shadow-sm"
                      :class="getLabelPreviewClass(template)"
                      :data-testid="`label-template-preview-${template.id}`"
                      :style="getLabelPreviewStyle(template)"
                    >
                      <div
                        class="relative shrink-0 overflow-hidden"
                        :data-testid="`label-template-artwork-${template.id}`"
                        :style="getLabelPreviewArtworkFrameStyle(template)"
                      >
                        <img
                          :alt="getLabelPreviewAlt(template)"
                          class="absolute left-1/2 top-1/2 block object-contain"
                          draggable="false"
                          :src="printPayloadSvgDataUrl"
                          :style="getLabelPreviewArtworkImageStyle()"
                        />
                      </div>
                      <div
                        aria-hidden="true"
                        class="pointer-events-none absolute -inset-px z-10 box-border border border-slate-300 dark:border-slate-700"
                        :class="getLabelPreviewClass(template)"
                        :data-testid="`label-template-preview-border-${template.id}`"
                      />
                    </div>
                    <span
                      class="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 text-xs font-medium leading-none text-slate-300 dark:text-slate-700"
                      :data-testid="`label-template-preview-width-${template.id}`"
                    >
                      {{ getLabelPreviewDimensionLabels(template).bottom }}
                    </span>
                    <span
                      class="pointer-events-none absolute left-full top-1/2 ml-1 -translate-y-1/2 text-xs font-medium leading-none text-slate-300 dark:text-slate-700 [writing-mode:vertical-rl]"
                      :data-testid="`label-template-preview-height-${template.id}`"
                    >
                      {{ getLabelPreviewDimensionLabels(template).right }}
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <UButton
                    block
                    class="min-h-16 justify-start whitespace-normal px-3 py-2 text-left"
                    color="neutral"
                    :data-testid="`label-template-preview-button-${template.id}`"
                    :loading="isTemplateActionLoading('preview', template)"
                    variant="subtle"
                    @click="previewLabelPdf(template)"
                  >
                    <span class="flex w-full min-w-0 items-center gap-3">
                      <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700">
                        <UIcon class="size-5" name="i-lucide-eye" />
                      </span>
                      <span class="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 leading-tight">
                        <span class="min-w-0 text-sm font-semibold"
                          >Preview</span
                        >
                        <span class="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold leading-none text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                          >Watermarked</span
                        >
                      </span>
                    </span>
                  </UButton>
                  <UButton
                    block
                    class="min-h-16 justify-start whitespace-normal px-3 py-2 text-left"
                    :data-testid="`label-template-purchase-button-${template.id}`"
                    :loading="isTemplateActionLoading('purchase', template)"
                    @click="purchaseLabelPdf(template)"
                  >
                    <span class="flex w-full min-w-0 items-center gap-3">
                      <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/15 text-white ring-1 ring-white/25">
                        <UIcon
                          class="size-5"
                          name="i-lucide-circle-dollar-sign"
                        />
                      </span>
                      <span class="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 leading-tight">
                        <span class="min-w-0 text-sm font-semibold"
                          >Purchase Printable PDF</span
                        >
                        <span class="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold leading-none ring-1 ring-white/20"
                          >1 Credit</span
                        >
                        <template v-if="dynamicLinkPurchaseLabel">
                          <span
                            aria-hidden="true"
                            class="col-span-2 mt-0.5 h-px bg-white/20"
                          />
                          <span class="min-w-0 text-xs font-medium opacity-90"
                            >{{ dynamicLinkPurchaseLabel }}</span
                          >
                          <span class="shrink-0">
                            <span class="inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold leading-none ring-1 ring-white/20"
                              >{{ dynamicLinkPurchaseCost }} Credit</span
                            >
                          </span>
                        </template>
                      </span>
                    </span>
                  </UButton>
                </div>

                <div
                  class="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"
                >
                  <span class="text-sm font-medium text-muted">Buy Blank Labels From:</span>
                  <a
                    :aria-label="`Buy ${template.description} from Avery`"
                    class="inline-flex h-8 items-center rounded border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                    :href="getAveryTemplateUrl(template)"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <svg
                      aria-label="Avery"
                      xmlns="http://www.w3.org/2000/svg"
                      role="img"
                      viewBox="0 0 97.75 46.23"
                      class="h-[17px] w-[35.5px]"
                    >
                      <title>Avery</title>
                      <polygon
                        points="92.19 14.47 87.89 21.91 83.58 14.47 78.19 14.47 85.18 26.58 82.29 31.58 87.68 31.58 97.58 14.47 92.19 14.47"
                        class="fill-[#005da8]"
                      />
                      <path
                        d="M70.46,22.64h-5v-4.1h5c1.59,0,2.56.678,2.56,2C73.02,21.753,72.129,22.64,70.46,22.64Zm7.3-2.29h0a5.328,5.328,0,0,0-1.51-4c-1.15-1.17-3-1.86-5.56-1.86H60.75V31.58h4.73v-5.2h3.94l3.47,5.2h5.46l-4.1-6A5.387,5.387,0,0,0,77.76,20.35Z"
                        class="fill-[#005da8]"
                      />
                      <polygon
                        points="8.16 30.57 10.5 46.23 50.72 40.22 49.71 33.47 47.38 33.47 48.09 38.27 12.45 43.6 10.5 30.57 8.16 30.57"
                        class="fill-[#de1d37]"
                      />
                      <polygon
                        points="46.55 24.81 54.72 24.81 54.72 21.08 46.55 21.08 46.55 18.49 57.15 18.49 57.15 14.47 41.86 14.47 41.86 31.58 57.27 31.58 57.27 27.55 46.55 27.55 46.55 24.81"
                        class="fill-[#005da8]"
                      />
                      <polygon
                        points="29.77 25.18 24.32 14.47 18.85 14.47 27.55 31.58 31.99 31.58 40.69 14.47 35.22 14.47 29.77 25.18"
                        class="fill-[#005da8]"
                      />
                      <path
                        d="M11.54,19.88L14.22,25H8.87ZM9,14.47L0,31.58H5.38l1.55-2.94h9.23l1.55,2.94h5.38l-9-17.11H9Z"
                        class="fill-[#005da8]"
                      />
                      <polygon
                        points="44.71 0 4.49 6.01 6 16.07 7.31 13.57 7.82 12.62 7.12 7.95 42.77 2.63 44.25 12.54 46.58 12.54 44.71 0"
                        class="fill-[#de1d37]"
                      />
                    </svg>
                  </a>
                  <a
                    :aria-label="`Buy ${template.description} from Amazon`"
                    class="inline-flex h-8 items-center rounded border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                    :href="getAmazonTemplateUrl(template)"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <img
                      src="/logos/amazon.svg"
                      alt="Amazon"
                      class="h-[17px] w-[56px] object-contain"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </UContainer>
</template>
