import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: {
      __QUALA_OPENAI_API_KEY__: JSON.stringify(env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "")
    }
  };
});
