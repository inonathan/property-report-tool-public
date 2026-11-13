/*!
 * Drop this where the form should appear:
 *   <script src="https://YOUR-APP-DOMAIN/embed.js" async></script>
 * It loads the form in an iframe and resizes it. Optional attributes: data-width="760px", data-brand="agency-id".
 */
(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;
  var base = new URL(script.src).origin;

  var frame = document.createElement("iframe");
  frame.src = base + "/embed?src=" + encodeURIComponent(location.href) +
    (script.getAttribute("data-brand") ? "&brand=" + encodeURIComponent(script.getAttribute("data-brand")) : "");
  frame.title = "Instant property estimate";
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("scrolling", "no");
  frame.style.cssText =
    "display:block;width:100%;max-width:" + (script.getAttribute("data-width") || "760px") +
    ";margin:0 auto;border:0;height:150px;min-height:150px;background:transparent;transition:height .2s ease";

  script.parentNode.insertBefore(frame, script);

  window.addEventListener("message", function (e) {
    if (e.origin !== base || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (d && d.type === "pr:height" && typeof d.height === "number") {
      frame.style.height = Math.min(Math.max(d.height, 120), 2000) + "px";
    }
  });
})();
