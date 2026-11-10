import { lazy, Suspense, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  useNavigate,
} from '@tanstack/react-router';

const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'));
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'));
const HospitalAuth = lazy(() => import('./pages/hospital/HospitalAuth'));
const HospitalDashboard = lazy(() => import('./pages/hospital/HospitalDashboard'));
const DispensaryAuth = lazy(() => import('./pages/dispensary/DispensaryAuth'));
const Workspace = lazy(() => import('./pages/Workspace'));

gsap.registerPlugin(ScrollTrigger);

function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen w-full flex items-center justify-center bg-bg-0 text-mint-300"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-mint-400/30 border-t-mint-400 animate-spin" />
        <span className="text-xs font-mono tracking-wider text-mint-300/80">Loading workspace...</span>
      </div>
    </div>
  );
}

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

function RootComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('rxify_token');
      localStorage.removeItem('rxify_hospital_token');
      navigate({ to: '/login' });
    };
    window.addEventListener('rxify-auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('rxify-auth-unauthorized', handleUnauthorized);
  }, [navigate]);

  return (
    <Suspense fallback={<RouteLoading />}>
      <Outlet />
    </Suspense>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
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

const dispensaryLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dispensary/login',
  component: DispensaryAuth,
});

const dispensaryRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dispensary/register',
  component: DispensaryAuth,
});

const dispensaryPortalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dispensary',
  component: Workspace,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace',
  component: Workspace,
});

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inventory',
  component: Workspace,
});

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: Workspace,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: Workspace,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Workspace,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  patientRoute,
  doctorRoute,
  hospitalLoginRoute,
  hospitalDashboardRoute,
  dispensaryLoginRoute,
  dispensaryRegisterRoute,
  dispensaryPortalRoute,
  workspaceRoute,
  inventoryRoute,
  ordersRoute,
  analyticsRoute,
  settingsRoute,
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
