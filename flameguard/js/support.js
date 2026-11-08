(() => {
const faqSearch = document.querySelector('#faq-search');
const faqItems = [...document.querySelectorAll('[data-faq]')];
const faqCount = document.querySelector('#faq-count');
const faqEmpty = document.querySelector('#faq-empty');
function updateFaqFilter() {
  const query = faqSearch.value.trim().toLowerCase();
  let shown = 0;
  faqItems.forEach((item) => {
    const visible = item.textContent.toLowerCase().includes(query);
    item.hidden = !visible;
    if (visible) shown += 1;
  });
  faqCount.textContent = window.FlameGuardI18n.t('topicCountSummary', { count: shown });
  faqEmpty.hidden = shown > 0;
}
faqSearch.addEventListener('input', updateFaqFilter);
window.addEventListener('flameguard:languagechange', updateFaqFilter);
})();
