import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { 
  Users, 
  AtSign, 
  Clock, 
  TrendingUp, 
  Plus,
  Bell,
  Bot,
  Edit,
  Trash2,
  Info,
  Search
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

const slotFormSchema = z.object({
  discordUserId: z.string().min(1, "Discord User ID is required"),
  username: z.string().min(1, "Username is required"),
  shopType: z.enum(["level1", "level2", "level3", "level4", "partnered"]),
  channelId: z.string().min(1, "Channel ID is required"),
  originalChannelName: z.string().min(1, "Channel name is required"),
});

type SlotFormData = z.infer<typeof slotFormSchema>;

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["/api/slots"],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/activity"],
  });

  // Mutations
  const createSlotMutation = useMutation({
    mutationFn: async (data: SlotFormData) => {
      const expiresAt = data.shopType === "level4" || data.shopType === "partnered" 
        ? null 
        : new Date(Date.now() + getShopTypeDuration(data.shopType));

      return apiRequest("POST", "/api/slots", {
        ...data,
        userId: data.discordUserId, // Use discordUserId as userId for now
        expiresAt,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsAddModalOpen(false);
      form.reset();
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiRequest("DELETE", `/api/slots/${slotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  // Form
  const form = useForm<SlotFormData>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      discordUserId: "",
      username: "",
      shopType: "level1",
      channelId: "",
      originalChannelName: "",
    },
  });

  const handleCreateSlot = (data: SlotFormData) => {
    createSlotMutation.mutate(data);
  };

  const handleDeleteSlot = (slotId: string) => {
    if (confirm("Are you sure you want to delete this slot?")) {
      deleteSlotMutation.mutate(slotId);
    }
  };

  // Filter slots
  const filteredSlots = slots.filter((slot: any) => {
    const matchesSearch = slot.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || slot.shopType === filterType;
    return matchesSearch && matchesFilter;
  });

  const getShopTypeInfo = (shopType: string) => {
    const configs = {
      level1: { name: "Level 1", color: "bg-blue-500/20 text-blue-400", duration: "1 Week", cooldown: "72h" },
      level2: { name: "Level 2", color: "bg-yellow-500/20 text-yellow-400", duration: "2 Weeks", cooldown: "48h" },
      level3: { name: "Level 3", color: "bg-purple-500/20 text-purple-400", duration: "1 Month", cooldown: "24h" },
      level4: { name: "Level 4", color: "bg-green-500/20 text-green-400", duration: "Lifetime", cooldown: "24h" },
      partnered: { name: "Partnered", color: "bg-gradient-to-r from-blue-500 to-purple-500 text-white", duration: "Lifetime", cooldown: "24h" },
    };
    return configs[shopType as keyof typeof configs] || configs.level1;
  };

  const getShopTypeDuration = (shopType: string) => {
    const durations = {
      level1: 7 * 24 * 60 * 60 * 1000, // 1 week
      level2: 14 * 24 * 60 * 60 * 1000, // 2 weeks
      level3: 30 * 24 * 60 * 60 * 1000, // 1 month
      level4: null, // lifetime
      partnered: null, // lifetime
    };
    return durations[shopType as keyof typeof durations];
  };

  const getStatusBadge = (slot: any) => {
    if (!slot.isActive) return <Badge variant="destructive">Inactive</Badge>;
    if (slot.pingsUsed >= slot.pingsAllowed) return <Badge className="bg-yellow-500/20 text-yellow-400">Rate Limited</Badge>;
    return <Badge className="bg-green-500/20 text-green-400">Active</Badge>;
  };

  const formatTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return { text: "Lifetime", subtext: "Never expires", color: "text-green-400" };
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return { text: "Expired", subtext: "Past due", color: "text-red-400" };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return { 
        text: `${days} day${days > 1 ? 's' : ''}`, 
        subtext: expires.toLocaleDateString(), 
        color: days <= 2 ? "text-red-400" : "text-white" 
      };
    } else {
      return { 
        text: `${hours} hour${hours > 1 ? 's' : ''}`, 
        subtext: expires.toLocaleDateString(), 
        color: "text-red-400" 
      };
    }
  };

  if (statsLoading || slotsLoading) {
    return (
      <div className="min-h-screen bg-discord-dark text-discord-text flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-12 h-12 text-discord-primary mx-auto mb-4 animate-pulse" />
          <p className="text-discord-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-discord-dark text-discord-text">
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-discord-darker flex-shrink-0 border-r border-discord-secondary">
          <div className="p-6 border-b border-discord-secondary">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-discord-primary rounded-lg flex items-center justify-center">
                <Bot className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Slot Bot</h1>
                <p className="text-sm text-discord-muted">Admin Panel</p>
              </div>
            </div>
          </div>
          
          <nav className="mt-6 px-4">
            <div className="space-y-2">
              <a href="#" className="flex items-center px-4 py-3 text-discord-text bg-discord-primary/20 rounded-lg border-l-4 border-discord-primary" data-testid="nav-dashboard">
                <TrendingUp className="w-5 h-5 text-discord-primary mr-3" />
                <span className="font-medium">Dashboard</span>
              </a>
              <a href="#" className="flex items-center px-4 py-3 text-discord-muted hover:text-discord-text hover:bg-discord-card rounded-lg transition-colors" data-testid="nav-active-slots">
                <Users className="w-5 h-5 mr-3" />
                <span>Active Slots</span>
                <span className="ml-auto bg-discord-success text-white text-xs px-2 py-1 rounded-full">{stats?.activeSlots || 0}</span>
              </a>
              <a href="#" className="flex items-center px-4 py-3 text-discord-muted hover:text-discord-text hover:bg-discord-card rounded-lg transition-colors" data-testid="nav-ping-logs">
                <Bell className="w-5 h-5 mr-3" />
                <span>Ping Logs</span>
              </a>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-discord-card border-b border-discord-secondary px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
                <p className="text-discord-muted">Manage your Discord slot bot and monitor user activity</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Button variant="ghost" size="sm" className="text-discord-muted hover:text-discord-text" data-testid="button-notifications">
                    <Bell className="h-4 w-4" />
                    {stats?.expiringSoon > 0 && (
                      <span className="absolute -top-1 -right-1 bg-discord-danger text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {stats.expiringSoon}
                      </span>
                    )}
                  </Button>
                </div>
                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-discord-primary hover:bg-discord-primary/80" data-testid="button-add-slot">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Slot
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-discord-card border-discord-secondary">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add New Slot</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleCreateSlot)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="discordUserId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-discord-text">Discord User ID</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="123456789" className="bg-discord-dark border-discord-secondary text-discord-text" data-testid="input-discord-user-id" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-discord-text">Username</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="username" className="bg-discord-dark border-discord-secondary text-discord-text" data-testid="input-username" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="shopType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-discord-text">Shop Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-discord-dark border-discord-secondary text-discord-text" data-testid="select-shop-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-discord-dark border-discord-secondary">
                                  <SelectItem value="level1">Level 1 - 1 Week, 1 Ping/72h</SelectItem>
                                  <SelectItem value="level2">Level 2 - 2 Week, 1 Ping/48h</SelectItem>
                                  <SelectItem value="level3">Level 3 - 1 Month, 1 Ping/24h</SelectItem>
                                  <SelectItem value="level4">Level 4 - Lifetime, 1 Ping/24h</SelectItem>
                                  <SelectItem value="partnered">Partnered - Lifetime, 2 Ping/24h</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="channelId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-discord-text">Channel ID</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="123456789" className="bg-discord-dark border-discord-secondary text-discord-text" data-testid="input-channel-id" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="originalChannelName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-discord-text">Channel Name</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="general" className="bg-discord-dark border-discord-secondary text-discord-text" data-testid="input-channel-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                          <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} data-testid="button-cancel">
                            Cancel
                          </Button>
                          <Button type="submit" className="bg-discord-primary hover:bg-discord-primary/80" disabled={createSlotMutation.isPending} data-testid="button-create-slot">
                            {createSlotMutation.isPending ? "Creating..." : "Create Slot"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="bg-discord-card border-discord-secondary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-discord-muted text-sm font-medium">Total Active Slots</p>
                      <p className="text-2xl font-bold text-white mt-2" data-testid="stat-total-slots">{stats?.activeSlots || 0}</p>
                      <p className="text-discord-success text-sm mt-1">
                        <TrendingUp className="w-4 h-4 inline mr-1" />
                        All systems operational
                      </p>
                    </div>
                    <div className="bg-discord-success/20 p-3 rounded-lg">
                      <Users className="text-discord-success text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-discord-card border-discord-secondary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-discord-muted text-sm font-medium">Today's Pings Used</p>
                      <p className="text-2xl font-bold text-white mt-2" data-testid="stat-today-pings">{stats?.todayPings || 0}</p>
                      <p className="text-discord-warning text-sm mt-1">
                        <AtSign className="w-4 h-4 inline mr-1" />
                        Active monitoring
                      </p>
                    </div>
                    <div className="bg-discord-warning/20 p-3 rounded-lg">
                      <AtSign className="text-discord-warning text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-discord-card border-discord-secondary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-discord-muted text-sm font-medium">Expiring Soon</p>
                      <p className="text-2xl font-bold text-white mt-2" data-testid="stat-expiring-soon">{stats?.expiringSoon || 0}</p>
                      <p className="text-discord-danger text-sm mt-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Requires attention
                      </p>
                    </div>
                    <div className="bg-discord-danger/20 p-3 rounded-lg">
                      <Clock className="text-discord-danger text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-discord-card border-discord-secondary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-discord-muted text-sm font-medium">Bot Status</p>
                      <p className="text-2xl font-bold text-white mt-2">Online</p>
                      <p className="text-discord-success text-sm mt-1">
                        <Bot className="w-4 h-4 inline mr-1" />
                        All systems active
                      </p>
                    </div>
                    <div className="bg-discord-primary/20 p-3 rounded-lg">
                      <Bot className="text-discord-primary text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="mb-8">
              <Card className="bg-discord-card border-discord-secondary">
                <CardHeader>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {activitiesLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-start space-x-3 p-3 bg-discord-dark rounded-lg animate-pulse">
                          <div className="w-8 h-8 bg-discord-secondary rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-discord-secondary rounded mb-2"></div>
                            <div className="h-3 bg-discord-secondary rounded w-3/4"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8 text-discord-muted">
                      <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No recent activity</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.slice(0, 5).map((activity: any) => (
                        <div key={activity.id} className="flex items-start space-x-3 p-3 bg-discord-dark rounded-lg" data-testid={`activity-${activity.type}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            activity.type === 'ping' ? 'bg-discord-warning' : 'bg-discord-success'
                          }`}>
                            {activity.type === 'ping' ? (
                              <AtSign className="text-white text-xs" />
                            ) : (
                              <Plus className="text-white text-xs" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-discord-text text-sm">{activity.message}</p>
                            <p className="text-discord-muted text-xs mt-1">
                              {getShopTypeInfo(activity.shopType).name} - {new Date(activity.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Active Slots Table */}
            <Card className="bg-discord-card border-discord-secondary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Active Slots</CardTitle>
                    <p className="text-discord-muted text-sm">Manage all active user slots and permissions</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-discord-dark border-discord-secondary pl-10 text-discord-text"
                        data-testid="input-search-users"
                      />
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-discord-muted" />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="bg-discord-dark border-discord-secondary text-discord-text w-32" data-testid="select-filter-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-discord-dark border-discord-secondary">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="level1">Level 1</SelectItem>
                        <SelectItem value="level2">Level 2</SelectItem>
                        <SelectItem value="level3">Level 3</SelectItem>
                        <SelectItem value="level4">Level 4</SelectItem>
                        <SelectItem value="partnered">Partnered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {slotsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 bg-discord-dark rounded-lg animate-pulse">
                        <div className="w-8 h-8 bg-discord-secondary rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-discord-secondary rounded w-1/4"></div>
                          <div className="h-3 bg-discord-secondary rounded w-1/3"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-6 bg-discord-secondary rounded w-16"></div>
                          <div className="h-4 bg-discord-secondary rounded w-12"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredSlots.length === 0 ? (
                  <div className="text-center py-8 text-discord-muted">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No slots found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSlots.map((slot: any) => {
                      const shopInfo = getShopTypeInfo(slot.shopType);
                      const timeInfo = formatTimeRemaining(slot.expiresAt);
                      
                      return (
                        <div key={slot.id} className="flex items-center justify-between p-4 bg-discord-dark rounded-lg hover:bg-discord-dark/80 transition-colors" data-testid={`slot-${slot.username}`}>
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarFallback className="bg-discord-primary text-white">
                                {slot.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-discord-text font-medium">@{slot.username}</p>
                              <p className="text-discord-muted text-xs">ID: {slot.discordUserId}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <Badge className={shopInfo.color}>
                              {shopInfo.name}
                            </Badge>
                            
                            <div className="text-right">
                              <p className="text-discord-text text-sm">
                                {slot.pingsUsed}/{slot.pingsAllowed} pings
                              </p>
                              <div className="w-16 bg-discord-secondary rounded-full h-2 mt-1">
                                <div 
                                  className={`h-2 rounded-full ${
                                    slot.pingsUsed >= slot.pingsAllowed ? 'bg-discord-danger' : 'bg-discord-success'
                                  }`}
                                  style={{ width: `${Math.min((slot.pingsUsed / slot.pingsAllowed) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className={`text-sm ${timeInfo.color}`}>{timeInfo.text}</p>
                              <p className="text-discord-muted text-xs">{timeInfo.subtext}</p>
                            </div>
                            
                            {getStatusBadge(slot)}
                            
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" className="text-discord-muted hover:text-discord-primary" data-testid={`button-edit-${slot.username}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-discord-muted hover:text-discord-danger" 
                                onClick={() => handleDeleteSlot(slot.id)}
                                disabled={deleteSlotMutation.isPending}
                                data-testid={`button-delete-${slot.username}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-discord-muted hover:text-discord-text" data-testid={`button-info-${slot.username}`}>
                                <Info className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
