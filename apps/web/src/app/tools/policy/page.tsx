import { PolicyTool } from '../../../components/public-tools';

export default function PolicyToolPage() {
  return (
    <section className="hero">
      <div>
        <h1>Policy gate</h1>
        <p className="lede">
          Fail-closed keyword and category checks for restricted products. Not legal advice —
          marketplace policies still apply.
        </p>
      </div>
      <PolicyTool />
    </section>
  );
}
