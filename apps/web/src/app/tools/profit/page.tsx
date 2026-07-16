import { ProfitTool } from '../../../components/public-tools';

export default function ProfitToolPage() {
  return (
    <section className="hero">
      <div>
        <h1>Unit economics calculator</h1>
        <p className="lede">
          Contribution profit for physical products. Includes marketplace fees, payment fees,
          supplier cost, shipping, ads, and return reserves. Revenue is never reported as profit.
        </p>
      </div>
      <ProfitTool />
    </section>
  );
}
