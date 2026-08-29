import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/react-router';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import PatientDashboard from './pages/patient/PatientDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import HospitalAuth from './pages/hospital/HospitalAuth';
import HospitalDashboard from './pages/hospital/HospitalDashboard';

gsap.registerPlugin(ScrollTrigger);

/* ─── Landing Wrapper — scoped Lenis smooth scroll ─── */
function LandingWithLenis() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  return <Landing />;
}

/* ─── Router Setup ─── */
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingWithLenis,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Auth,
});

// Post-auth dashboards
const patientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/patient',
  component: PatientDashboard,
});

const doctorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor',
  component: DoctorDashboard,
});

const hospitalLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hospital/login',
  component: HospitalAuth,
});

const hospitalDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hospital',
  component: HospitalDashboard,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  patientRoute,
  doctorRoute,
  hospitalLoginRoute,
  hospitalDashboardRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
