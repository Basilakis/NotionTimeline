import { Button } from "@/components/ui/button";
import { RefreshCw, Settings, Database, History } from "lucide-react";

interface HeaderProps {
  filterStatus: string;
  onFilterChange: (status: string) => void;
  onSync: () => void;
  isLoading: boolean;
}

export function Header({ filterStatus, onFilterChange, onSync, isLoading }: HeaderProps) {
  const filterButtons = [
    { key: 'all', label: 'All Tasks' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <History className="text-blue-700 h-5 w-5" />
              <h1 className="text-xl font-medium text-gray-900">TaskFlow History</h1>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
              <Database className="h-4 w-4" />
              <span>Project Management DB</span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {filterButtons.map((filter) => (
                <Button
                  key={filter.key}
                  variant={filterStatus === filter.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onFilterChange(filter.key)}
                  className={filterStatus === filter.key 
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100" 
                    : "text-gray-500 hover:bg-gray-100"
                  }
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              disabled={isLoading}
              className="text-gray-500 hover:text-blue-700 hover:bg-gray-100"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-blue-700 hover:bg-gray-100"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
