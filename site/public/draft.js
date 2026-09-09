// Draft page: highlight the current section in the sidebar TOC while scrolling.
(function () {
  const tocLinks = Array.from(document.querySelectorAll(".draft-toc a"));
  if (!tocLinks.length) return;
  const linkById = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  const headings = Array.from(document.querySelectorAll(".draft-content h2[id], .draft-content h3[id]"));

  let current = null;
  function setActive(id) {
    if (id === current) return;
    current = id;
    tocLinks.forEach((a) => a.classList.remove("active"));
    const link = linkById.get(id);
    if (link) {
      link.classList.add("active");
      link.scrollIntoView({ block: "nearest" });
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    },
    { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
  );
  headings.forEach((h) => observer.observe(h));
})();
