'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SHIFT_CATEGORIES, ShiftCategory } from '@turnos/shared';

export default function NewShift() {
  const router = useRouter();
  
  const [category, setCategory] = useState<ShiftCategory>('Hospitality');
  const [subcategory, setSubcategory] = useState<string>(SHIFT_CATEGORIES['Hospitality'][0]);
  const [role, setRole] = useState(''); // Optional custom label
  
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hourlyRate, setHourlyRate] = useState<string>('8.00');
  const [address, setAddress] = useState('');

  // Update subcategory when category changes
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value as ShiftCategory;
    setCategory(newCat);
    setSubcategory(SHIFT_CATEGORIES[newCat][0]);
  };

  // Cost Calculator
  const rateNum = parseFloat(hourlyRate) || 0;
  const tsuRate = 0.2375; // 23.75% Taxa Social Única
  const tsuCost = rateNum * tsuRate;
  const totalHourlyCost = rateNum + tsuCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Send to actual API
    // await fetch('/api/shifts', { method: 'POST', body: ... })
    
    alert('Shift successfully posted to Turnos!');
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-secondary p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Post a New Shift</h1>

        <div className="bg-white shadow rounded-lg p-6" style={{ borderRadius: 'var(--radius-lg)' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={category}
                  onChange={handleCategoryChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                >
                  {Object.keys(SHIFT_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Subcategory (Role)</label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                >
                  {SHIFT_CATEGORIES[category].map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Custom Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Bartender"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address (Location)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rua Augusta 123, Lisboa"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <hr className="my-6 border-gray-200" />

            {/* Financials & TSU Calculator */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
              <h3 className="text-lg font-bold text-blue-900 mb-4">Payout & Costs</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-blue-800">Gross Hourly Rate (€) to Worker</label>
                  <input
                    type="number"
                    step="0.10"
                    min="5.00"
                    required
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm text-lg font-bold focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-2 text-xs text-blue-600">Minimum wage requirements apply.</p>
                </div>

                <div className="flex flex-col justify-center space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span>Worker Gross Pay:</span>
                    <span className="font-semibold">€{rateNum.toFixed(2)} / hr</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-200 pb-2">
                    <span>TSU (23.75%):</span>
                    <span>€{tsuCost.toFixed(2)} / hr</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-base">
                    <span>Total Employer Cost:</span>
                    <span>€{totalHourlyCost.toFixed(2)} / hr</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-bold text-white hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Post Shift
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
