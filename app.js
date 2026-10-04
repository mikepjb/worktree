const markdown = window.markdownit({
  html: false,
  linkify: true,
  typographer: false,
});

function renderMarkdown(source) {
  return markdown.render(source);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });

      await navigator.serviceWorker.ready;
      console.info("Service worker ready:", registration.scope);
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}
