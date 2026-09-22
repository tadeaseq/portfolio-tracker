import { Position } from "@/lib/api";

export default function PortfolioTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No positions yet — upload a T212 export or connect a broker to get started.
      </p>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left border-b border-gray-200">
          <th className="py-2 pr-4">Ticker</th>
          <th className="py-2 pr-4">Broker</th>
          <th className="py-2 pr-4">Quantity</th>
          <th className="py-2 pr-4">Avg. buy price</th>
          <th className="py-2 pr-4">Currency</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => (
          <tr key={`${p.ticker}-${p.broker}-${i}`} className="border-b border-gray-100">
            <td className="py-2 pr-4 font-medium">{p.ticker}</td>
            <td className="py-2 pr-4 text-gray-500">{p.broker}</td>
            <td className="py-2 pr-4">{p.quantity}</td>
            <td className="py-2 pr-4">{p.avg_buy_price.toFixed(2)}</td>
            <td className="py-2 pr-4 text-gray-500">{p.currency}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
