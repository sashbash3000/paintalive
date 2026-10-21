<template>
  <router-view />
</template>

<style>
* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  height: 100%;
}

body {
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', system-ui, sans-serif;
  background: #fff8e7;
  color: #3b2a1a;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

button {
  font: inherit;
  cursor: pointer;
}

.big-button {
  border: none;
  border-radius: 999px;
  padding: 0.8em 1.6em;
  font-size: 1.3rem;
  font-weight: bold;
  color: #fff;
  background: #ff8a3d;
  box-shadow: 0 5px 0 #c9621f;
  transition: transform 0.1s, box-shadow 0.1s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
}

.big-button:active {
  transform: translateY(4px);
  box-shadow: 0 1px 0 #c9621f;
}

.big-button.secondary {
  background: #fff;
  color: #3b2a1a;
  box-shadow: 0 5px 0 #d8c8a8;
}

.big-button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
