/// <reference types="vite/client" />

declare module "*.md" {
  import type { MDXContent } from "mdx/types";
  const Content: MDXContent;
  export default Content;
}
