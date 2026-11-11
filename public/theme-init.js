// Aplica o tema antes do React carregar (evita piscar). Arquivo separado
// para respeitar a Content-Security-Policy (sem script inline).
(function () {
  try {
    var raw = localStorage.getItem('sigef_theme_v2_blank');
    var theme = raw ? JSON.parse(raw) : 'dark';
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
