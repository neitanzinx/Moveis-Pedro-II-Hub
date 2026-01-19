import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function StatsCard({ title, value, icon: Icon, gradient, linkTo }) {
  return (
    <Link to={linkTo}>
      <Card className="relative overflow-hidden hover:shadow-xl transition-all duration-300 border-0 group cursor-pointer">
        <div 
          className="absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity"
          style={{ background: gradient }}
        />
        <CardContent className="relative p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Icon className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/90 mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}