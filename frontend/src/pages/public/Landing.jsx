import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Workflow,
  FolderOpen,
  FileText,
  CreditCard,
  Building2,
  Check,
  ArrowRight,
  ShieldCheck,
  Cloud,
  UserCog,
  Layers,
  Mail,
  Phone,
  MapPin,
  Target,
  Sparkles,
} from 'lucide-react';
import ThemeToggle from '../../components/common/ThemeToggle';

const BRAND_GRADIENT =
  'linear-gradient(135deg, #00D4FF 0%, #5B7FFF 55%, #8B4FE8 100%)';

const gradientText = {
  background: BRAND_GRADIENT,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const features = [
  {
    icon: Users,
    title: 'Student Application Management',
    description:
      'Capture, track, and manage every student application from first inquiry to final enrollment in one organized workspace.',
  },
  {
    icon: Workflow,
    title: 'Stage-based Visa Workflow',
    description:
      'Move students through structured EMGS, EVAL, and eVisa stages with clear status, owners, and timelines at every step.',
  },
  {
    icon: FolderOpen,
    title: 'Document Management',
    description:
      'Collect and organize passports, transcripts, and certificates with secure Google Drive integration built in.',
  },
  {
    icon: FileText,
    title: 'Offer Letter / LOE Generation',
    description:
      'Generate polished offer letters and Letters of Eligibility in seconds using your own branded templates.',
  },
  {
    icon: CreditCard,
    title: 'Payments & Invoicing',
    description:
      'Issue invoices, record payments, and keep a clean financial trail for every student and partner institution.',
  },
  {
    icon: Building2,
    title: 'Multi-tenant Agency Branding',
    description:
      'Run multiple agencies with isolated data and tailored branding, so every tenant gets a first-class experience.',
  },
];

const benefits = [
  {
    icon: Layers,
    title: 'Centralized operations',
    description:
      'Every student, document, and payment lives in one place — no more scattered spreadsheets or email threads.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    description:
      'Sensitive student and visa data is protected with modern security practices and granular access controls.',
  },
  {
    icon: UserCog,
    title: 'Role-based access',
    description:
      'Give counselors, admins, and partners exactly the access they need — nothing more, nothing less.',
  },
  {
    icon: Cloud,
    title: 'Cloud storage',
    description:
      'Documents sync to Google Drive, so your team can access files securely from anywhere, anytime.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo-icon.png"
              alt="MashRoute"
              className="h-9 w-9 object-contain"
            />
            <span
              className="text-xl font-extrabold tracking-tight"
              style={gradientText}
            >
              MashRoute
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <a href="#about" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">About</a>
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#contact" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Contact</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:bg-accent"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.03]"
              style={{ background: BRAND_GRADIENT }}
            >
              <span className="hidden sm:inline">Create Company Account</span>
              <span className="sm:hidden">Sign Up</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        {/* gradient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center sm:py-32">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
              Student Application Management Portal
            </span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
          >
            Run your study-abroad agency on{' '}
            <span style={gradientText}>one platform</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
          >
            Manage student applications, track visa stages, organize documents,
            and handle payments — all in one secure, multi-tenant workspace built
            for modern education agencies.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <button
              onClick={() => navigate('/signup')}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] sm:w-auto"
              style={{ background: BRAND_GRADIENT }}
            >
              Create Company Account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground/80 transition-colors hover:bg-accent sm:w-auto"
            >
              Login
            </button>
          </motion.div>
        </div>
      </section>

      {/* ===== About ===== */}
      <section id="about" className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> About MashRoute
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              The operating system for study-abroad agencies
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              MashRoute is a multi-tenant SaaS platform built specifically for education and migration
              agencies. From the first student inquiry to a successful visa and enrollment, every step
              lives in one secure workspace — applications, documents, offer letters, payments, and
              visa stages.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Each agency gets its own isolated, branded environment with role-based access for admins,
              counselors, and agents — so your data stays private and your team stays focused.
            </p>
            <div className="mt-7 flex flex-wrap gap-6">
              {[
                ['100%', 'Cloud-based'],
                ['Multi', 'Tenant isolation'],
                ['Role', 'Based access'],
              ].map(([big, small]) => (
                <div key={small}>
                  <p className="text-2xl font-extrabold" style={gradientText}>{big}</p>
                  <p className="text-xs text-muted-foreground">{small}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div className="rounded-3xl border border-border bg-card p-8 shadow-premium">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md" style={{ background: BRAND_GRADIENT }}>
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Our mission</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Replace scattered spreadsheets and email threads with one streamlined, reliable system —
                so agencies can help more students reach their study-abroad goals with less overhead.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'Purpose-built for visa & admission workflows',
                  'Secure document handling with cloud storage',
                  'Transparent payments & invoicing',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything your agency needs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Powerful tools that bring your entire student pipeline into a single,
            streamlined view.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                className="group rounded-2xl border border-border bg-card p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ===== Benefits ===== */}
      <section className="relative overflow-hidden bg-muted/40">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the way agencies work
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Secure, organized, and accessible — so your team can focus on
              students, not spreadsheets.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
            {benefits.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={fadeUp}
                  transition={{ duration: 0.4, delay: (i % 2) * 0.08 }}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-base font-semibold text-foreground">
                        {benefit.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Contact / Support ===== */}
      <section id="contact" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Get in touch</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Questions about MashRoute or need help getting started? Our team is here for you.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { icon: Mail, label: 'Email us', value: 'support@mashroute.com', href: 'mailto:support@mashroute.com' },
              { icon: Phone, label: 'Call us', value: '+880 1700-000000', href: 'tel:+8801700000000' },
              { icon: MapPin, label: 'Visit us', value: 'Dhaka, Bangladesh', href: null },
            ].map((c, i) => {
              const Icon = c.icon;
              const inner = (
                <>
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md" style={{ background: BRAND_GRADIENT }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{c.value}</p>
                </>
              );
              return (
                <motion.div
                  key={c.label}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={fadeUp}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-2xl border border-border bg-card p-7 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  {c.href ? (
                    <a href={c.href} className="block">{inner}</a>
                  ) : (
                    inner
                  )}
                </motion.div>
              );
            })}
          </div>

          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Prefer to get started right away?{' '}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Create your company account
              </Link>{' '}
              and we&apos;ll review it for approval.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl px-8 py-16 text-center shadow-xl sm:px-16"
          style={{ background: BRAND_GRADIENT }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg">
              Set up your agency in minutes and bring your entire student
              pipeline online today.
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="group mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-navy-900 shadow-lg transition-transform hover:scale-[1.03]"
            >
              Create Company Account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-icon.png"
              alt="MashRoute"
              className="h-7 w-7 object-contain"
            />
            <span className="text-sm font-bold" style={gradientText}>
              MashRoute
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/login" className="transition-colors hover:text-foreground">
              Login
            </Link>
            <Link to="/signup" className="transition-colors hover:text-foreground">
              Sign Up
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MashRoute. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
