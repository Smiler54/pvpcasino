import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getConnectionStatus } from "@/lib/socket";
import { Wifi, WifiOff } from "lucide-react";

export const ConnectionStatus = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleConnectionStatus = (event: CustomEvent) => {
      setIsConnected(event.detail.connected);
    };

    // Check initial connection status
    setIsConnected(getConnectionStatus());

    // Listen for connection status changes
    window.addEventListener('connection-status', handleConnectionStatus as EventListener);

    return () => {
      window.removeEventListener('connection-status', handleConnectionStatus as EventListener);
    };
  }, []);

  return (
    <Badge 
      variant={isConnected ? "default" : "destructive"}
      className={`${isConnected ? 'bg-crypto-green' : ''} flex items-center gap-1`}
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Connected
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Disconnected
        </>
      )}
    </Badge>
  );
};