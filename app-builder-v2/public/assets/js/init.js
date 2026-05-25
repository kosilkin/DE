'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  // Check if launched in runtime mode via shortcut
  if (window.__RUNTIME_MODE && window.__RUNTIME_PROJECT_ID) {
    try {
      const project = await callApi(() => api.projects.get(window.__RUNTIME_PROJECT_ID));
      if (project) {
        AppShell.init();
        AppShell.setProject(project);
        AppShell.navigate('runtime');
        return;
      }
    } catch {}
  }
  AppShell.init();
});
