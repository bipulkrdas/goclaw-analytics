/**
 * App.tsx — Minimal IoT Analytics Dashboard Template
 *
 * CRITICAL: Total output must fit within 4000 tokens.
 * LANGUAGE: Plain JavaScript + JSX. NO TypeScript annotations.
 * Keep inline data to max 12-24 hourly objects + summary object + 5 insights.
 */

import React from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Activity, Zap, TrendingUp, Clock } from "lucide-react";

// Hourly aggregated data — max 12-24 objects, compact keys
const D=[
  {h:"06:00",p:1.2,c:10.0,e:52380},
  {h:"07:00",p:1.4,c:11.3,e:52381},
  {h:"08:00",p:1.5,c:12.7,e:52383},
  {h:"09:00",p:1.6,c:13.4,e:52385},
  {h:"10:00",p:1.6,c:12.9,e:52386},
  {h:"11:00",p:1.7,c:14.0,e:52388},
  {h:"12:00",p:1.7,c:14.3,e:52389},
  {h:"13:00",p:1.7,c:13.8,e:52391},
  {h:"14:00",p:1.5,c:12.3,e:52393},
  {h:"15:00",p:0.8,c:6.8,e:52393},
  {h:"16:00",p:0.0,c:0.0,e:52393},
  {h:"17:00",p:1.4,c:11.5,e:52395},
];

// Summary stats
const S={energy:14.8,avgPwr:1.33,peakA:15.6,uptime:83.3,readings:120,hours:11};

// Insights (max 5)
const I=[
  "Power peaks 11:00\u201313:00 averaging 1.7 kW. Consider load shifting.",
  "Device failure at 15:00\u201316:00 (120 min downtime exceeds threshold).",
  "Current trend increasing +0.43 A/hr from 06:00\u201312:00 (p<0.05).",
  "Monthly projection: 972 kWh (~$117/mo at $0.12/kWh).",
  "Peak current 15.6A at 12:00 exceeds 95th percentile (14.9A).",
];

export default function App(){
  return(
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-6 h-6 text-blue-600"/>
          <h1 className="text-2xl font-bold text-gray-900">Air Conditioning Unit</h1>
        </div>
        <p className="text-sm text-gray-500">Jun 12, 2026 06:00\u201317:00 EDT \u00b7 {S.readings} readings \u00b7 {S.hours} hours</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card icon={<Zap className="w-4 h-4"/>} label="Energy" value={S.energy+" kWh"} color="amber"/>
        <Card icon={<TrendingUp className="w-4 h-4"/>} label="Avg Power" value={S.avgPwr+" kW"} color="blue"/>
        <Card icon={<Activity className="w-4 h-4"/>} label="Peak Current" value={S.peakA+" A"} color="emerald"/>
        <Card icon={<Clock className="w-4 h-4"/>} label="Uptime" value={S.uptime+"%"} color="cyan"/>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Power & Current Trend</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={D} margin={{top:5,right:20,left:10,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey="h" label={{value:"Hour",position:"insideBottom",offset:-5}}/>
            <YAxis yAxisId="l" label={{value:"kW",angle:-90,position:"insideLeft"}}/>
            <YAxis yAxisId="r" orientation="right" label={{value:"A",angle:90,position:"insideRight"}}/>
            <Tooltip/>
            <Legend/>
            <Line yAxisId="l" type="monotone" dataKey="p" stroke="#3b82f6" strokeWidth={2} dot={false} name="Power (kW)"/>
            <Line yAxisId="r" type="monotone" dataKey="c" stroke="#10b981" strokeWidth={2} dot={false} name="Current (A)"/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Hourly Power Distribution</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={D} margin={{top:5,right:20,left:10,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey="h"/>
            <YAxis label={{value:"kW",angle:-90,position:"insideLeft"}}/>
            <Tooltip/>
            <Bar dataKey="p" fill="#8b5cf6" name="Avg Power (kW)" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Insights & Risks</h2>
        <div className="space-y-2">
          {I.map((t,i)=>(
            <div key={i} className="flex gap-2 p-2 bg-blue-50 rounded text-sm text-gray-700">
              <span className="text-blue-600 font-bold">{i+1}.</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({icon, label, value, color}){
  return(
    <div className={`bg-white rounded-lg shadow p-3 border-l-4 border-${color}-500`}>
      <div className={`flex items-center gap-1 text-${color}-700 mb-1`}>
        {icon}<span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
