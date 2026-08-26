/// <reference types="vite/client" />

declare module "*.md" {
  import type { MDXContent } from "mdx/types";
  const Content: MDXContent;
  export default Content;
}

declare module "*.cast?raw" {
  const text: string;
  export default text;
}

declare module "@wterm/react/css";
