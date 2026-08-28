import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";

const STEPS = [
  {
    title: "Enter your crop details",
    body: "Crop, quantity and your current location — takes under a minute.",
  },
  {
    title: "We compare every option",
    body: "APMC mandis and government procurement centres, on price, distance, transport cost and waiting time.",
  },
  {
    title: "Get one clear recommendation",
    body: "Ranked by expected net benefit, with a plain-language explanation of why.",
  },
];

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <section id="how-it-works" className="border-t border-soil-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-bold text-soil-900 sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-sm font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-semibold text-soil-900">{step.title}</h3>
                <p className="mt-2 text-sm text-soil-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-soil-100 py-8 text-center text-xs text-soil-600">
        Agri-Track — Prototype build for Smart India Hackathon 2026. Market data shown is sample data.
      </footer>
    </main>
  );
}
