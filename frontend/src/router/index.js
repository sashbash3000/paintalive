import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import World from '../views/World.vue'
import AddAnimal from '../views/AddAnimal.vue'
import { SCENES } from '../game/scenes'

const sceneGuard = (to) => (SCENES[to.params.scene] ? true : { name: 'Home' })

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/world/:scene', name: 'World', component: World, beforeEnter: sceneGuard },
  { path: '/world/:scene/add', name: 'AddAnimal', component: AddAnimal, beforeEnter: sceneGuard },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
