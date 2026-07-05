import { createRouter, createWebHistory } from 'vue-router'
import LanguageView from '../views/LanguageView.vue'
import HomeView from '../views/HomeView.vue'
import HostView from '../views/HostView.vue'
import JoinView from '../views/JoinView.vue'
import PlayView from '../views/PlayView.vue'
import ScreenView from '../views/ScreenView.vue'
import ManageView from '../views/ManageView.vue'
import { getSavedLocale } from '../i18n/index.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: LanguageView,
      beforeEnter: () => {
        // Skip language picker if user already has a preference saved
        if (getSavedLocale()) return '/home'
      },
    },
    { path: '/home', component: HomeView },
    { path: '/language', component: LanguageView },
    { path: '/host', component: HostView },
    { path: '/join', component: JoinView },
    { path: '/play', component: PlayView },
    { path: '/screen/:code', component: ScreenView },
    { path: '/manage', component: ManageView },
  ],
})

export default router
