import { ScoreTool } from '../../../components/public-tools';

export default function ScoreToolPage() {
  return (
    <section className="hero">
      <div>
        <h1>Opportunity score</h1>
        <p className="lede">
          Explainable 0–100 score from demand, margin, competition, reviews, shipping, and policy
          risk. Educational heuristic — not a guarantee of sales.
        </p>
      </div>
      <ScoreTool />
    </section>
  );
}
