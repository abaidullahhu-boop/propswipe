import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { Switch, Route, useLocation } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import { store } from "./store";
import { useAppDispatch } from "./store/hooks";
import { loadFromStorage } from "./store/slices/authSlice";
import Home from "@/pages/Home";
import SavedProperties from "@/pages/SavedProperties";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import ForgotPassword from "@/pages/ForgotPassword";
import AdminLayout from "@/pages/AdminLayout";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProperties from "@/pages/AdminProperties";
import AdminSettings from "@/pages/AdminSettings";
import AdminUpload from "@/pages/AdminUpload";
import PropertyPage from "@/pages/Property";
import AdminLeads from "@/pages/AdminLeads";
import AdminAnalytics from "@/pages/AdminAnalytics";
import AdminReports from "@/pages/AdminReports";
import SharedSavedProperties from "@/pages/SharedSavedProperties";
import Offline from "@/pages/Offline";
import MapPage from "@/pages/Map";
import PlotFinderV2Page from "@/pages/PlotFinderV2";
import NotFound from "@/pages/not-found";
import { LoadingScreen } from "@/components/LoadingScreen";
import InstallPromptBanner from "@/components/InstallPromptBanner";
import OfflineBanner from "@/components/OfflineBanner";
import { ThemeProvider } from "@/hooks/use-theme";

function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user?.role !== "admin") {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect to={user?.role === "admin" ? "/admin" : "/"} />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login">
        <PublicOnlyRoute>
          <Login />
        </PublicOnlyRoute>
      </Route>
      <Route path="/signup">
        <PublicOnlyRoute>
          <SignUp />
        </PublicOnlyRoute>
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>
      <Route path="/saved">
        <PrivateRoute>
          <SavedProperties />
        </PrivateRoute>
      </Route>
      <Route path="/shared/:userId" component={SharedSavedProperties} />
      <Route path="/offline" component={Offline} />
      <Route path="/map" component={MapPage} />
      <Route path="/plot-finder">
        <PrivateRoute>
          <PlotFinderV2Page />
        </PrivateRoute>
      </Route>
      <Route path="/plot-finder/v2">
        <PrivateRoute>
          <PlotFinderV2Page />
        </PrivateRoute>
      </Route>
      <Route path="/property/:id" component={PropertyPage} />
      <Route path="/admin">
        <PrivateRoute adminOnly>
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </PrivateRoute>
      </Route>
      <Route path="/admin/properties">
        <PrivateRoute adminOnly>
          <AdminLayout>
            <AdminProperties />
          </AdminLayout>
        </PrivateRoute>
      </Route>
      <Route path="/admin/upload">
        <PrivateRoute adminOnly>
          <AdminLayout>
            <AdminUpload />
          </AdminLayout>
        </PrivateRoute>
      </Route>
      <Route path="/admin/leads">
        <PrivateRoute adminOnly>
          <AdminLayout>
            <AdminLeads />
          </AdminLayout>
        </PrivateRoute>
      </Route>
      <Route path="/admin/analytics">
        <PrivateRoute adminOnly>
          <AdminLayout>
            <AdminAnalytics />
          </AdminLayout>
        </PrivateRoute>
      </Route>
      <Route path="/admin/reports">
        <PrivateRoute adminOnly>
          <AdminLayout>
            <AdminReports />
          </AdminLayout>
        </PrivateRoute>
      </Route>
      <Route path="/admin/settings">
        <PrivateRoute adminOnly>
          <AdminLayout>
            <AdminSettings />
          </AdminLayout>
        </PrivateRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Load auth state from localStorage on mount
    dispatch(loadFromStorage());
  }, [dispatch]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster position="top-right" />
          <InstallPromptBanner />
          <OfflineBanner />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
