import type { SavedQrCode } from "./saved-qr";

export type LabelPrintPayload = {
  createdAt: number;
  height: number;
  name?: string;
  svg: string;
  title: string;
  url?: string;
  width: number;
};

export type LabelTemplateType = "rectangle" | "square" | "circle";

export type LabelTemplateLayout = {
  columns: number;
  rows: number;
  pageWidth: number;
  pageHeight: number;
  labelWidth: number;
  labelHeight: number;
  marginLeft: number;
  marginTop: number;
  columnGap: number;
  rowGap: number;
  labelPadding: number;
};

export type LabelTemplate = {
  aspectRatio: number;
  id: string;
  label: string;
  description: string;
  templateNumber: string;
  type: LabelTemplateType;
  layout: LabelTemplateLayout;
};

export type LabelArtworkPlacement = {
  height: number;
  rotate: boolean;
  scale: number;
  width: number;
};

export const labelPrintPayloadStorageKey = "cuteqrcodes.labelPrintPayload";

export const pdfPointsPerInch = 72;

export const labelPdfRenderLongEdgePixels = 1200;

export function createLabelPrintPayloadFromSavedQr(
  qrCode: SavedQrCode,
): LabelPrintPayload {
  return {
    createdAt: Date.now(),
    height: qrCode.previewHeight,
    name: qrCode.name,
    svg: qrCode.previewSvg,
    title: qrCode.name,
    url:
      typeof qrCode.payload?.url === "string" ? qrCode.payload.url : undefined,
    width: qrCode.previewWidth,
  };
}

export function getSuggestedLabelTemplateIds(
  payload: Pick<LabelPrintPayload, "height" | "width">,
  templates = labelTemplates,
) {
  const payloadAspectRatio = getAspectRatio(payload.width, payload.height);

  if (!Number.isFinite(payloadAspectRatio)) {
    return [];
  }

  if (isSquareAspectRatio(payloadAspectRatio)) {
    return templates
      .filter(
        (template) => template.type === "square" || template.type === "circle",
      )
      .map((template) => template.id);
  }

  return templates
    .filter((template) => template.type === "rectangle")
    .map((template) => ({
      id: template.id,
      score: getLabelArtworkOccupancyScore(payload, template),
    }))
    .sort((first, second) => second.score - first.score)
    .slice(0, 2)
    .map((template) => template.id);
}

export function getLabelArtworkPlacement(
  payload: Pick<LabelPrintPayload, "height" | "width">,
  template: LabelTemplate,
): LabelArtworkPlacement {
  const availableArea = getLabelArtworkAvailableArea(template);
  const { availableHeight, availableWidth } = availableArea;
  const uprightFit = getArtworkFit(
    payload.width,
    payload.height,
    availableWidth,
    availableHeight,
  );
  const rotatedFit = getArtworkFit(
    payload.height,
    payload.width,
    availableWidth,
    availableHeight,
  );

  if (rotatedFit.scale > uprightFit.scale) {
    return {
      ...rotatedFit,
      rotate: true,
    };
  }

  return {
    ...uprightFit,
    rotate: false,
  };
}

const letterPageWidth = 8.5;
const letterPageHeight = 11;

function createLayout({
  columns,
  rows,
  labelWidth,
  labelHeight,
  marginLeft,
  marginTop,
  labelPadding = 0.125,
}: {
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  marginLeft: number;
  marginTop: number;
  labelPadding?: number;
}): LabelTemplateLayout {
  return {
    columns,
    rows,
    pageWidth: letterPageWidth * pdfPointsPerInch,
    pageHeight: letterPageHeight * pdfPointsPerInch,
    labelWidth: labelWidth * pdfPointsPerInch,
    labelHeight: labelHeight * pdfPointsPerInch,
    marginLeft: marginLeft * pdfPointsPerInch,
    marginTop: marginTop * pdfPointsPerInch,
    columnGap:
      columns > 1
        ? ((letterPageWidth - marginLeft * 2 - labelWidth * columns) /
            (columns - 1)) *
          pdfPointsPerInch
        : 0,
    rowGap:
      rows > 1
        ? ((letterPageHeight - marginTop * 2 - labelHeight * rows) /
            (rows - 1)) *
          pdfPointsPerInch
        : 0,
    labelPadding: labelPadding * pdfPointsPerInch,
  };
}

function createLabelTemplate(
  template: Omit<LabelTemplate, "aspectRatio">,
): LabelTemplate {
  const aspectRatio = getAspectRatio(
    template.layout.labelWidth,
    template.layout.labelHeight,
  );

  return {
    ...template,
    aspectRatio,
  };
}

function getArtworkFit(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
) {
  if (
    width <= 0 ||
    height <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return {
      height: 0,
      scale: 0,
      width: 0,
    };
  }

  const scale = Math.min(availableWidth / width, availableHeight / height);

  return {
    height: height * scale,
    scale,
    width: width * scale,
  };
}

function getLabelArtworkOccupancyScore(
  payload: Pick<LabelPrintPayload, "height" | "width">,
  template: LabelTemplate,
) {
  const { availableHeight, availableWidth } =
    getLabelArtworkAvailableArea(template);
  const placement = getLabelArtworkPlacement(payload, template);
  const availableArea = availableWidth * availableHeight;

  return availableArea > 0
    ? (placement.width * placement.height) / availableArea
    : 0;
}

function getLabelArtworkAvailableArea(template: LabelTemplate) {
  if (template.type === "circle") {
    const diameter = Math.min(
      template.layout.labelWidth,
      template.layout.labelHeight,
    );
    const availableSide =
      Math.max(0, diameter - template.layout.labelPadding * 2) / Math.SQRT2;

    return {
      availableHeight: availableSide,
      availableWidth: availableSide,
    };
  }

  return {
    availableHeight:
      template.layout.labelHeight - template.layout.labelPadding * 2,
    availableWidth:
      template.layout.labelWidth - template.layout.labelPadding * 2,
  };
}

function getAspectRatio(width: number, height: number) {
  return height > 0 ? width / height : Number.NaN;
}

function isSquareAspectRatio(aspectRatio: number) {
  return Math.abs(Math.log(aspectRatio)) <= Math.log(1.08);
}

export const labelTemplates: LabelTemplate[] = [
  createLabelTemplate({
    id: "avery-presta-94256",
    label: '3.5" x 5"',
    description: "Avery Presta® Template 94256",
    templateNumber: "94256",
    type: "rectangle",
    layout: createLayout({
      columns: 2,
      rows: 2,
      labelWidth: 3.5,
      labelHeight: 5,
      marginLeft: 0.5,
      marginTop: 0.425,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94207",
    label: '2" x 4"',
    description: "Avery Presta® Template 94207",
    templateNumber: "94207",
    type: "rectangle",
    layout: createLayout({
      columns: 2,
      rows: 5,
      labelWidth: 4,
      labelHeight: 2,
      marginLeft: 0.156,
      marginTop: 0.5,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94237",
    label: '2" x 3"',
    description: "Avery Presta® Template 94237",
    templateNumber: "94237",
    type: "rectangle",
    layout: createLayout({
      columns: 2,
      rows: 4,
      labelWidth: 3,
      labelHeight: 2,
      marginLeft: 0.85,
      marginTop: 1,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94100",
    label: '4" x 4"',
    description: "Avery Presta® Template 94100",
    templateNumber: "94100",
    type: "square",
    layout: createLayout({
      columns: 2,
      rows: 2,
      labelWidth: 3.937,
      labelHeight: 3.937,
      marginLeft: 0.2505,
      marginTop: 1,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94101",
    label: '3" x 3"',
    description: "Avery Presta® Template 94101",
    templateNumber: "94101",
    type: "square",
    layout: createLayout({
      columns: 2,
      rows: 3,
      labelWidth: 3,
      labelHeight: 3,
      marginLeft: 0.625,
      marginTop: 0.625,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94514",
    label: '3.5"',
    description: "Avery Presta® Template 94514",
    templateNumber: "94514",
    type: "circle",
    layout: createLayout({
      columns: 2,
      rows: 2,
      labelWidth: 3.5,
      labelHeight: 3.5,
      marginLeft: 0.5,
      marginTop: 1.5,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94513",
    label: '3"',
    description: "Avery Presta® Template 94513",
    templateNumber: "94513",
    type: "circle",
    layout: createLayout({
      columns: 2,
      rows: 3,
      labelWidth: 3,
      labelHeight: 3,
      marginLeft: 0.625,
      marginTop: 0.625,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94502",
    label: '2.5"',
    description: "Avery Presta® Template 94502",
    templateNumber: "94502",
    type: "circle",
    layout: createLayout({
      columns: 3,
      rows: 3,
      labelWidth: 2.5,
      labelHeight: 2.5,
      marginLeft: 0.375,
      marginTop: 1,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94501",
    label: '2"',
    description: "Avery Presta® Template 94501",
    templateNumber: "94501",
    type: "circle",
    layout: createLayout({
      columns: 3,
      rows: 4,
      labelWidth: 2,
      labelHeight: 2,
      marginLeft: 0.625,
      marginTop: 0.625,
    }),
  }),
  createLabelTemplate({
    id: "avery-presta-94506",
    label: '1.5"',
    description: "Avery Presta® Template 94506",
    templateNumber: "94506",
    type: "circle",
    layout: createLayout({
      columns: 4,
      rows: 5,
      labelWidth: 1.5,
      labelHeight: 1.5,
      marginLeft: 0.5,
      marginTop: 0.75,
    }),
  }),
];
