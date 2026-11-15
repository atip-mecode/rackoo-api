export type LineTextMessage = {
  type: "text";
  text: string;
};

export type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: {
    type: "bubble";
    size: "giga";
    header: {
      type: "box";
      layout: "vertical";
      backgroundColor: string;
      contents: Array<{
        type: "text";
        text: string;
        color: string;
        weight: "bold";
        size: "lg";
        wrap: true;
      }>;
    };
    body: {
      type: "box";
      layout: "vertical";
      spacing: "md";
      contents: Array<
        | { type: "text"; text: string; weight?: "bold"; size?: "sm" | "md"; wrap?: true; color?: string }
        | { type: "separator" }
      >;
    };
  };
};

export type LineReplyMessage = LineTextMessage | LineFlexMessage;
