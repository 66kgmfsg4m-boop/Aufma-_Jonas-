import { register } from "node:module";

register(new URL("./alias-loader.ts", import.meta.url).href, import.meta.url);
