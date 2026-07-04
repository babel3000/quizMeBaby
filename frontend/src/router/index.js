import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import HostView from '../views/HostView.vue'
import JoinView from '../views/JoinView.vue'
import PlayView from '../views/PlayView.vue'
import ScreenView from '../views/ScreenView.vue'
import ManageView from '../views/ManageView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/host', component: HostView },
    { path: '/join', component: JoinView },
    { path: '/play', component: PlayView },
    { path: '/screen/:code', component: ScreenView },
    { path: '/manage', component: ManageView },
  ],
})

export default router
