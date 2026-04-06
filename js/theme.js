document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  const body = document.documentElement; // Or body, we can just use documentElement for data-theme
  
  // Load saved theme
  const savedTheme = localStorage.getItem('ms_theme') || 'light';
  if (savedTheme === 'dark') {
    body.setAttribute('data-theme', 'dark');
    if (themeToggle) themeToggle.textContent = '☀️';
  } else {
    body.setAttribute('data-theme', 'light');
    if (themeToggle) themeToggle.textContent = '🌙';
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (body.getAttribute('data-theme') === 'dark') {
        body.setAttribute('data-theme', 'light');
        localStorage.setItem('ms_theme', 'light');
        themeToggle.textContent = '🌙';
      } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('ms_theme', 'dark');
        themeToggle.textContent = '☀️';
      }
    });
  }
});
