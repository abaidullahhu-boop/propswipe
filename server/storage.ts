import {
  type User,
  type InsertUser,
  type Property,
  type InsertProperty,
  type SavedProperty,
  type InsertSavedProperty,
  type PropertyDislike,
  type InsertPropertyDislike,
  type PropertyView,
  type InsertPropertyView,
  type Lead,
  type InsertLead,
  type SavedFilter,
  type InsertSavedFilter,
  type PropertyReport,
  type InsertPropertyReport,
  type PropertyAuditLog,
  type InsertPropertyAuditLog,
  type PropertyWatchEvent,
  type InsertPropertyWatchEvent,
  type DismissedArea,
  type InsertDismissedArea,
  type Society,
  type InsertSociety,
  type SocietyBlock,
  type InsertSocietyBlock,
  type BlockPlot,
  type InsertBlockPlot,
} from "../shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

/** In-memory seed uses a public HTTPS MP4 so `<video src>` matches production S3-style URLs. */
const DEV_SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Property methods
  getAllProperties(): Promise<Property[]>;
  getSocieties(search?: string): Promise<Society[]>;
  createSociety(society: InsertSociety): Promise<Society>;
  getSocietyBlocks(societyId: string): Promise<SocietyBlock[]>;
  createSocietyBlock(block: InsertSocietyBlock): Promise<SocietyBlock>;
  getBlockPlots(blockId: string): Promise<BlockPlot[]>;
  createBlockPlot(plot: InsertBlockPlot): Promise<BlockPlot>;
  updateBlockPlot(
    plotId: string,
    updates: Partial<Pick<InsertBlockPlot, "plotNumber" | "x" | "y" | "size" | "status" | "metaJson">>
  ): Promise<BlockPlot>;
  getPlotById(plotId: string): Promise<{ plot: BlockPlot; block: SocietyBlock; society: Society } | undefined>;
  getBlockDetails(blockId: string): Promise<{ block: SocietyBlock; plots: BlockPlot[] } | undefined>;
  searchPlots(
    query: string,
    societyId?: string
  ): Promise<Array<{ society: Society; block: SocietyBlock; plot: BlockPlot }>>;
  getProperty(id: string): Promise<Property | undefined>;
  // Used by Plot Finder to know whether a plot already has a listing (and its video).
  getPropertyByPlotId(plotId: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  incrementPropertyViews(id: string): Promise<void>;

  // Saved property methods
  getAllSavedProperties(): Promise<SavedProperty[]>;
  getSavedPropertiesByUser(userId: string): Promise<SavedProperty[]>;
  saveProperty(savedProperty: InsertSavedProperty): Promise<SavedProperty>;
  unsaveProperty(userId: string, propertyId: string): Promise<void>;

  // Property dislike methods
  dislikeProperty(dislike: InsertPropertyDislike): Promise<PropertyDislike>;
  getDislikedPropertyIds(userId: string): Promise<string[]>;

  // Property view methods
  getPropertyView(userId: string, propertyId: string): Promise<PropertyView | undefined>;
  recordPropertyView(view: InsertPropertyView): Promise<PropertyView>;

  // Saved filter methods
  getSavedFiltersByUser(userId: string): Promise<SavedFilter[]>;
  createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter>;
  deleteSavedFilter(id: string, userId: string): Promise<void>;

  // Dismissed areas
  getDismissedAreasByUser(userId: string): Promise<DismissedArea[]>;
  addDismissedArea(area: InsertDismissedArea): Promise<DismissedArea>;

  // Reports & audit logs
  createPropertyReport(report: InsertPropertyReport): Promise<PropertyReport>;
  getPropertyReports(): Promise<PropertyReport[]>;
  createPropertyAuditLog(log: InsertPropertyAuditLog): Promise<PropertyAuditLog>;
  getPropertyAuditLogs(propertyId: string): Promise<PropertyAuditLog[]>;

  // Watch events
  recordPropertyWatchEvent(event: InsertPropertyWatchEvent): Promise<PropertyWatchEvent>;
  getPropertyWatchEvents(propertyId: string): Promise<PropertyWatchEvent[]>;

  // Lead methods
  getAllLeads(): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLeadStatus(id: string, status: string): Promise<Lead>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private properties: Map<string, Property>;
  private savedProperties: Map<string, SavedProperty>;
  private propertyDislikes: Map<string, PropertyDislike>;
  private propertyViews: Map<string, PropertyView>;
  private leads: Map<string, Lead>;
  private savedFilters: Map<string, SavedFilter>;
  private propertyReports: Map<string, PropertyReport>;
  private propertyAuditLogs: Map<string, PropertyAuditLog>;
  private propertyWatchEvents: Map<string, PropertyWatchEvent>;
  private dismissedAreas: Map<string, DismissedArea>;
  private societies: Map<string, Society>;
  private societyBlocks: Map<string, SocietyBlock>;
  private blockPlots: Map<string, BlockPlot>;

  constructor() {
    this.users = new Map();
    this.properties = new Map();
    this.savedProperties = new Map();
    this.propertyDislikes = new Map();
    this.propertyViews = new Map();
    this.leads = new Map();
    this.savedFilters = new Map();
    this.propertyReports = new Map();
    this.propertyAuditLogs = new Map();
    this.propertyWatchEvents = new Map();
    this.dismissedAreas = new Map();
    this.societies = new Map();
    this.societyBlocks = new Map();
    this.blockPlots = new Map();
    
    if (process.env.SEED_SAMPLE_PROPERTIES === "true") {
      this.seedSampleData();
    } else {
      console.log(
        "[seed] Demo listings disabled (set SEED_SAMPLE_PROPERTIES=true to seed in-memory sample properties)."
      );
    }

    // Dev-only admin seed
    this.seedAdmin();
  }

  private seedSampleData() {
    const sampleProperties = [
      {
        id: randomUUID(),
        title: "Modern Downtown Loft",
        address: "123 Main Street",
        city: "San Francisco",
        state: "CA",
        price: "1250000",
        bedrooms: 2,
        bathrooms: "2.0",
        squareFeet: 1500,
        description: "Stunning modern loft in the heart of downtown with panoramic city views",
        videoUrl: DEV_SAMPLE_VIDEO_URL,
        thumbnailUrl: "",
        neighborhood: "",
        latitude: null,
        longitude: null,
        videoStatus: "ready",
        durationSeconds: null,
        filesizeBytes: null,
        width: null,
        height: null,
        plotId: null,
        status: "active",
        views: 0,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        title: "Beachfront Villa",
        address: "456 Ocean Avenue",
        city: "Santa Monica",
        state: "CA",
        price: "3500000",
        bedrooms: 4,
        bathrooms: "3.5",
        squareFeet: 3200,
        description: "Luxurious beachfront property with direct ocean access",
        videoUrl: DEV_SAMPLE_VIDEO_URL,
        thumbnailUrl: "",
        neighborhood: "",
        latitude: null,
        longitude: null,
        videoStatus: "ready",
        durationSeconds: null,
        filesizeBytes: null,
        width: null,
        height: null,
        plotId: null,
        status: "active",
        views: 0,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        title: "Mountain Retreat",
        address: "789 Pine Ridge Road",
        city: "Lake Tahoe",
        state: "CA",
        price: "975000",
        bedrooms: 3,
        bathrooms: "2.5",
        squareFeet: 2400,
        description: "Peaceful mountain home with stunning lake views",
        videoUrl: DEV_SAMPLE_VIDEO_URL,
        thumbnailUrl: "",
        neighborhood: "",
        latitude: null,
        longitude: null,
        videoStatus: "ready",
        durationSeconds: null,
        filesizeBytes: null,
        width: null,
        height: null,
        plotId: null,
        status: "active",
        views: 0,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        title: "Urban Penthouse",
        address: "321 Skyline Drive",
        city: "Los Angeles",
        state: "CA",
        price: "2100000",
        bedrooms: 3,
        bathrooms: "3.0",
        squareFeet: 2800,
        description: "Sophisticated penthouse with floor-to-ceiling windows",
        videoUrl: DEV_SAMPLE_VIDEO_URL,
        thumbnailUrl: "",
        neighborhood: "",
        latitude: null,
        longitude: null,
        videoStatus: "ready",
        durationSeconds: null,
        filesizeBytes: null,
        width: null,
        height: null,
        plotId: null,
        status: "active",
        views: 0,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        title: "Family Home",
        address: "555 Maple Street",
        city: "Palo Alto",
        state: "CA",
        price: "2450000",
        bedrooms: 5,
        bathrooms: "4.0",
        squareFeet: 3500,
        description: "Spacious family home in excellent school district",
        videoUrl: DEV_SAMPLE_VIDEO_URL,
        thumbnailUrl: "",
        neighborhood: "",
        latitude: null,
        longitude: null,
        videoStatus: "ready",
        durationSeconds: null,
        filesizeBytes: null,
        width: null,
        height: null,
        plotId: null,
        status: "active",
        views: 0,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        title: "Historic Brownstone",
        address: "888 Heritage Lane",
        city: "San Francisco",
        state: "CA",
        price: "1850000",
        bedrooms: 3,
        bathrooms: "2.5",
        squareFeet: 2200,
        description: "Beautifully restored Victorian-era brownstone",
        videoUrl: DEV_SAMPLE_VIDEO_URL,
        thumbnailUrl: "",
        neighborhood: "",
        latitude: null,
        longitude: null,
        videoStatus: "ready",
        durationSeconds: null,
        filesizeBytes: null,
        width: null,
        height: null,
        plotId: null,
        status: "active",
        views: 0,
        createdAt: new Date(),
      },
    ];

    sampleProperties.forEach((property) => {
      this.properties.set(property.id, property as Property);
    });
  }

  private seedAdmin() {
    // Only seed if explicitly enabled or in development
    const shouldSeed =
      process.env.SEED_ADMIN === "true" || process.env.NODE_ENV === "development";
    if (!shouldSeed) return;
  
    const email = process.env.ADMIN_EMAIL || "admin@propswipe.com";
    const name = process.env.ADMIN_NAME || "Admin";
    const plainPassword = process.env.ADMIN_PASSWORD || "admin12345";
  
    // If an admin already exists, skip
    const alreadyExists = Array.from(this.users.values()).some(
      (u) => u.email === email
    );
    if (alreadyExists) return;
  
    const id = randomUUID();
    const passwordHash = bcrypt.hashSync(plainPassword, 10);
  
    const adminUser = {
      id,
      email,
      name,
      passwordHash,
      role: "admin" as const,
      createdAt: new Date(),
    };
  
    this.users.set(id, adminUser);
    // eslint-disable-next-line no-console
    console.log(
      `[seed] Admin user created: ${email} (password: ${plainPassword})`
    );
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      name: insertUser.name ?? null,      // ✅ normalize to null
      passwordHash: insertUser.passwordHash,  // ✅ add password hash
      role: insertUser.role ?? "user",    // ✅ default value
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }
  
  

  async getAllProperties(): Promise<Property[]> {
    return Array.from(this.properties.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getSocieties(search?: string): Promise<Society[]> {
    const term = String(search ?? "").trim().toLowerCase();
    const all = Array.from(this.societies.values());
    const filtered = term
      ? all.filter((s) =>
          [s.name, s.city, s.state].some((value) => String(value).toLowerCase().includes(term))
        )
      : all;
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createSociety(insertSociety: InsertSociety): Promise<Society> {
    const id = randomUUID();
    const society: Society = {
      id,
      name: insertSociety.name,
      city: insertSociety.city,
      state: insertSociety.state,
      createdAt: new Date(),
    };
    this.societies.set(id, society);
    return society;
  }

  async getSocietyBlocks(societyId: string): Promise<SocietyBlock[]> {
    return Array.from(this.societyBlocks.values()).filter((b) => b.societyId === societyId);
  }

  async createSocietyBlock(insertBlock: InsertSocietyBlock): Promise<SocietyBlock> {
    const id = randomUUID();
    const block: SocietyBlock = {
      id,
      societyId: insertBlock.societyId,
      name: insertBlock.name,
      imagePath: insertBlock.imagePath,
      widthPx: insertBlock.widthPx,
      heightPx: insertBlock.heightPx,
      createdAt: new Date(),
    };
    this.societyBlocks.set(id, block);
    return block;
  }

  async getBlockPlots(blockId: string): Promise<BlockPlot[]> {
    return Array.from(this.blockPlots.values()).filter((p) => p.blockId === blockId);
  }

  async createBlockPlot(insertPlot: InsertBlockPlot): Promise<BlockPlot> {
    const id = randomUUID();
    const plot: BlockPlot = {
      id,
      blockId: insertPlot.blockId,
      plotNumber: insertPlot.plotNumber,
      x: String(insertPlot.x),
      y: String(insertPlot.y),
      size: insertPlot.size ?? null,
      status: insertPlot.status ?? "available",
      metaJson: insertPlot.metaJson ?? null,
      createdAt: new Date(),
    };
    this.blockPlots.set(id, plot);
    return plot;
  }

  async updateBlockPlot(
    plotId: string,
    updates: Partial<Pick<InsertBlockPlot, "plotNumber" | "x" | "y" | "size" | "status" | "metaJson">>
  ): Promise<BlockPlot> {
    const existing = this.blockPlots.get(plotId);
    if (!existing) {
      throw new Error("Plot not found");
    }

    const updated: BlockPlot = {
      ...existing,
      plotNumber: updates.plotNumber ?? existing.plotNumber,
      x: updates.x !== undefined ? String(updates.x) : existing.x,
      y: updates.y !== undefined ? String(updates.y) : existing.y,
      size: updates.size !== undefined ? updates.size : existing.size,
      status: updates.status ?? existing.status,
      metaJson: updates.metaJson !== undefined ? updates.metaJson : existing.metaJson,
    };

    this.blockPlots.set(plotId, updated);
    return updated;
  }

  async getPlotById(plotId: string): Promise<{ plot: BlockPlot; block: SocietyBlock; society: Society } | undefined> {
    const plot = this.blockPlots.get(plotId);
    if (!plot) return undefined;
    const block = this.societyBlocks.get(plot.blockId);
    if (!block) return undefined;
    const society = this.societies.get(block.societyId);
    if (!society) return undefined;
    return { plot, block, society };
  }

  async getBlockDetails(blockId: string): Promise<{ block: SocietyBlock; plots: BlockPlot[] } | undefined> {
    const block = this.societyBlocks.get(blockId);
    if (!block) return undefined;
    const plots = await this.getBlockPlots(block.id);
    return { block, plots };
  }

  async searchPlots(
    query: string,
    societyId?: string
  ): Promise<Array<{ society: Society; block: SocietyBlock; plot: BlockPlot }>> {
    const term = String(query ?? "").trim().toLowerCase();
    if (!term) return [];
    const societies = await this.getSocieties();
    const targetSocietyIds = societyId ? new Set([societyId]) : new Set(societies.map((s) => s.id));
    const results: Array<{ society: Society; block: SocietyBlock; plot: BlockPlot }> = [];
    for (const society of societies) {
      if (!targetSocietyIds.has(society.id)) continue;
      const blocks = await this.getSocietyBlocks(society.id);
      for (const block of blocks) {
        const plots = await this.getBlockPlots(block.id);
        for (const plot of plots) {
          if (String(plot.plotNumber).toLowerCase().includes(term)) {
            results.push({ society, block, plot });
          }
        }
      }
    }
    return results.slice(0, 25);
  }

  async getProperty(id: string): Promise<Property | undefined> {
    return this.properties.get(id);
  }

  async getPropertyByPlotId(plotId: string): Promise<Property | undefined> {
    // For in-memory mode, a plot can only be linked to one property in practice.
    // Return the property by plotId; the frontend decides whether it's "read-only" based on `videoUrl`.
    return Array.from(this.properties.values()).find((p) => p.plotId === plotId);
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const id = randomUUID();
    const property: Property = {
      id,
      title: insertProperty.title ?? "Untitled Property",
      address: insertProperty.address ?? "",
      city: insertProperty.city ?? "",
      state: insertProperty.state ?? "",
      neighborhood: insertProperty.neighborhood ?? null,
      latitude: insertProperty.latitude ?? null,
      longitude: insertProperty.longitude ?? null,
      price: insertProperty.price ?? "0",
      bedrooms: insertProperty.bedrooms ?? 0,
      bathrooms: insertProperty.bathrooms ?? "0",
      squareFeet: insertProperty.squareFeet ?? 0,
      description: insertProperty.description ?? null,   // ✅ null instead of ""
      videoUrl: insertProperty.videoUrl ?? null,
      thumbnailUrl: insertProperty.thumbnailUrl ?? null,
      videoStatus: insertProperty.videoStatus ?? "ready",
      durationSeconds: insertProperty.durationSeconds ?? null,
      filesizeBytes: insertProperty.filesizeBytes ?? null,
      width: insertProperty.width ?? null,
      height: insertProperty.height ?? null,
      plotId: insertProperty.plotId ?? null,
      status: insertProperty.status ?? "active",
      views: 0,
      createdAt: new Date(),
    };
    this.properties.set(id, property);
    return property;
  }
  
  

  async updateProperty(
    id: string,
    updates: Partial<InsertProperty>
  ): Promise<Property> {
    const property = this.properties.get(id);
    if (!property) {
      throw new Error("Property not found");
    }
    const updated = { ...property, ...updates };
    this.properties.set(id, updated);
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    this.properties.delete(id);
    Array.from(this.savedProperties.entries()).forEach(([key, saved]) => {
      if (saved.propertyId === id) {
        this.savedProperties.delete(key);
      }
    });
  }

  async incrementPropertyViews(id: string): Promise<void> {
    const property = this.properties.get(id);
    if (property) {
      property.views += 1;
      this.properties.set(id, property);
    }
  }

  async getAllSavedProperties(): Promise<SavedProperty[]> {
    return Array.from(this.savedProperties.values());
  }

  async getSavedPropertiesByUser(userId: string): Promise<SavedProperty[]> {
    return Array.from(this.savedProperties.values()).filter(
      (saved) => saved.userId === userId
    );
  }

  async saveProperty(
    insertSavedProperty: InsertSavedProperty
  ): Promise<SavedProperty> {
    const id = randomUUID();
    const savedProperty: SavedProperty = {
      ...insertSavedProperty,
      id,
      savedAt: new Date(),
    };
    this.savedProperties.set(id, savedProperty);
    return savedProperty;
  }

  async unsaveProperty(userId: string, propertyId: string): Promise<void> {
    const entry = Array.from(this.savedProperties.entries()).find(
      ([_, saved]) => saved.userId === userId && saved.propertyId === propertyId
    );
    if (entry) {
      this.savedProperties.delete(entry[0]);
    }
  }

  async dislikeProperty(
    insertDislike: InsertPropertyDislike
  ): Promise<PropertyDislike> {
    const id = randomUUID();
    const dislike: PropertyDislike = {
      ...insertDislike,
      id,
      dislikedAt: new Date(),
    };
    this.propertyDislikes.set(id, dislike);
    return dislike;
  }

  async getDislikedPropertyIds(userId: string): Promise<string[]> {
    return Array.from(this.propertyDislikes.values())
      .filter((dislike) => dislike.userId === userId)
      .map((dislike) => dislike.propertyId);
  }

  async getPropertyView(userId: string, propertyId: string): Promise<PropertyView | undefined> {
    return Array.from(this.propertyViews.values()).find(
      (view) => view.userId === userId && view.propertyId === propertyId
    );
  }

  async recordPropertyView(insertView: InsertPropertyView): Promise<PropertyView> {
    const id = randomUUID();
    const view: PropertyView = {
      ...insertView,
      id,
      viewedAt: new Date(),
    };
    this.propertyViews.set(id, view);
    return view;
  }

  async getSavedFiltersByUser(userId: string): Promise<SavedFilter[]> {
    return Array.from(this.savedFilters.values()).filter(
      (filter) => filter.userId === userId
    );
  }

  async createSavedFilter(insertFilter: InsertSavedFilter): Promise<SavedFilter> {
    const id = randomUUID();
    const savedFilter: SavedFilter = {
      ...insertFilter,
      id,
      createdAt: new Date(),
    };
    this.savedFilters.set(id, savedFilter);
    return savedFilter;
  }

  async deleteSavedFilter(id: string, userId: string): Promise<void> {
    const existing = this.savedFilters.get(id);
    if (existing && existing.userId === userId) {
      this.savedFilters.delete(id);
    }
  }

  async getDismissedAreasByUser(userId: string): Promise<DismissedArea[]> {
    return Array.from(this.dismissedAreas.values()).filter(
      (area) => area.userId === userId
    );
  }

  async addDismissedArea(area: InsertDismissedArea): Promise<DismissedArea> {
    const id = randomUUID();
    const dismissed: DismissedArea = {
      ...area,
      id,
      createdAt: new Date(),
    };
    this.dismissedAreas.set(id, dismissed);
    return dismissed;
  }

  async createPropertyReport(
    report: InsertPropertyReport
  ): Promise<PropertyReport> {
    const id = randomUUID();
    const created: PropertyReport = {
      ...report,
      id,
      userId: report.userId ?? null,
      details: report.details ?? null,
      createdAt: new Date(),
    };
    this.propertyReports.set(id, created);
    return created;
  }

  async getPropertyReports(): Promise<PropertyReport[]> {
    return Array.from(this.propertyReports.values());
  }

  async createPropertyAuditLog(
    log: InsertPropertyAuditLog
  ): Promise<PropertyAuditLog> {
    const id = randomUUID();
    const created: PropertyAuditLog = {
      ...log,
      id,
      actorId: log.actorId ?? null,
      metaJson: log.metaJson ?? null,
      createdAt: new Date(),
    };
    this.propertyAuditLogs.set(id, created);
    return created;
  }

  async getPropertyAuditLogs(propertyId: string): Promise<PropertyAuditLog[]> {
    return Array.from(this.propertyAuditLogs.values()).filter(
      (log) => log.propertyId === propertyId
    );
  }

  async recordPropertyWatchEvent(
    event: InsertPropertyWatchEvent
  ): Promise<PropertyWatchEvent> {
    const id = randomUUID();
    const created: PropertyWatchEvent = {
      ...event,
      id,
      userId: event.userId ?? null,
      durationSeconds: event.durationSeconds ?? null,
      createdAt: new Date(),
    };
    this.propertyWatchEvents.set(id, created);
    return created;
  }

  async getPropertyWatchEvents(propertyId: string): Promise<PropertyWatchEvent[]> {
    return Array.from(this.propertyWatchEvents.values()).filter(
      (event) => event.propertyId === propertyId
    );
  }

  async getAllLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = {
      ...insertLead,
      id,
      userId: insertLead.userId ?? null,
      email: insertLead.email ?? null,
      phone: insertLead.phone ?? null,
      message: insertLead.message ?? null,
      preferredDate: insertLead.preferredDate ?? null,
      preferredTime: insertLead.preferredTime ?? null,
      contactMethod: insertLead.contactMethod ?? null,
      status: "new",
      createdAt: new Date(),
    };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead> {
    const existing = this.leads.get(id);
    if (!existing) {
      throw new Error("Lead not found");
    }
    const updated = { ...existing, status };
    this.leads.set(id, updated);
    return updated;
  }
}

import { DbStorage } from "./db-storage";

const HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL !== "");
const IS_PROD = process.env.NODE_ENV === "production";
const ALLOW_FALLBACK =
  process.env.ALLOW_STORAGE_FALLBACK === "true" || !IS_PROD;

class HybridStorage implements IStorage {
  constructor(private primary: IStorage, private fallback: IStorage) {}

  private async withFallback<T>(
    opName: string,
    primaryOp: () => Promise<T>,
    fallbackOp: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryOp();
    } catch (error) {
      // In production we want to fail loudly rather than silently serving ephemeral data.
      if (!ALLOW_FALLBACK) throw error;

      console.error(`[Storage] ${opName} failed; falling back to in-memory storage`, error);
      return await fallbackOp();
    }
  }

  // User methods
  getUser(id: string) {
    return this.withFallback("getUser", () => this.primary.getUser(id), () => this.fallback.getUser(id));
  }
  getUserByEmail(email: string) {
    return this.withFallback(
      "getUserByEmail",
      () => this.primary.getUserByEmail(email),
      () => this.fallback.getUserByEmail(email)
    );
  }
  createUser(user: InsertUser) {
    return this.withFallback(
      "createUser",
      () => this.primary.createUser(user),
      () => this.fallback.createUser(user)
    );
  }

  // Property methods
  getAllProperties() {
    return this.withFallback(
      "getAllProperties",
      () => this.primary.getAllProperties(),
      () => this.fallback.getAllProperties()
    );
  }
  getSocieties(search?: string) {
    return this.withFallback(
      "getSocieties",
      () => this.primary.getSocieties(search),
      () => this.fallback.getSocieties(search)
    );
  }
  createSociety(society: InsertSociety) {
    return this.withFallback(
      "createSociety",
      () => this.primary.createSociety(society),
      () => this.fallback.createSociety(society)
    );
  }
  getSocietyBlocks(societyId: string) {
    return this.withFallback(
      "getSocietyBlocks",
      () => this.primary.getSocietyBlocks(societyId),
      () => this.fallback.getSocietyBlocks(societyId)
    );
  }
  createSocietyBlock(block: InsertSocietyBlock) {
    return this.withFallback(
      "createSocietyBlock",
      () => this.primary.createSocietyBlock(block),
      () => this.fallback.createSocietyBlock(block)
    );
  }
  getBlockPlots(blockId: string) {
    return this.withFallback(
      "getBlockPlots",
      () => this.primary.getBlockPlots(blockId),
      () => this.fallback.getBlockPlots(blockId)
    );
  }
  createBlockPlot(plot: InsertBlockPlot) {
    return this.withFallback(
      "createBlockPlot",
      () => this.primary.createBlockPlot(plot),
      () => this.fallback.createBlockPlot(plot)
    );
  }

  updateBlockPlot(
    plotId: string,
    updates: Partial<Pick<InsertBlockPlot, "plotNumber" | "x" | "y" | "size" | "status" | "metaJson">>
  ) {
    return this.withFallback(
      "updateBlockPlot",
      () => this.primary.updateBlockPlot(plotId, updates),
      () => this.fallback.updateBlockPlot(plotId, updates)
    );
  }

  getPlotById(plotId: string) {
    return this.withFallback(
      "getPlotById",
      () => this.primary.getPlotById(plotId),
      () => this.fallback.getPlotById(plotId)
    );
  }
  getBlockDetails(blockId: string) {
    return this.withFallback(
      "getBlockDetails",
      () => this.primary.getBlockDetails(blockId),
      () => this.fallback.getBlockDetails(blockId)
    );
  }
  searchPlots(query: string, societyId?: string) {
    return this.withFallback(
      "searchPlots",
      () => this.primary.searchPlots(query, societyId),
      () => this.fallback.searchPlots(query, societyId)
    );
  }
  getProperty(id: string) {
    return this.withFallback(
      "getProperty",
      () => this.primary.getProperty(id),
      () => this.fallback.getProperty(id)
    );
  }

  getPropertyByPlotId(plotId: string) {
    return this.withFallback(
      "getPropertyByPlotId",
      () => this.primary.getPropertyByPlotId(plotId),
      () => this.fallback.getPropertyByPlotId(plotId)
    );
  }
  createProperty(property: InsertProperty) {
    if (HAS_DATABASE_URL) {
      return this.primary.createProperty(property);
    }
    return this.withFallback(
      "createProperty",
      () => this.primary.createProperty(property),
      () => this.fallback.createProperty(property)
    );
  }
  updateProperty(id: string, property: Partial<InsertProperty>) {
    return this.withFallback(
      "updateProperty",
      () => this.primary.updateProperty(id, property),
      () => this.fallback.updateProperty(id, property)
    );
  }
  deleteProperty(id: string) {
    return this.withFallback(
      "deleteProperty",
      () => this.primary.deleteProperty(id),
      () => this.fallback.deleteProperty(id)
    );
  }
  incrementPropertyViews(id: string) {
    return this.withFallback(
      "incrementPropertyViews",
      () => this.primary.incrementPropertyViews(id),
      () => this.fallback.incrementPropertyViews(id)
    );
  }

  // Saved property methods
  getAllSavedProperties() {
    return this.withFallback(
      "getAllSavedProperties",
      () => this.primary.getAllSavedProperties(),
      () => this.fallback.getAllSavedProperties()
    );
  }
  getSavedPropertiesByUser(userId: string) {
    return this.withFallback(
      "getSavedPropertiesByUser",
      () => this.primary.getSavedPropertiesByUser(userId),
      () => this.fallback.getSavedPropertiesByUser(userId)
    );
  }
  saveProperty(savedProperty: InsertSavedProperty) {
    return this.withFallback(
      "saveProperty",
      () => this.primary.saveProperty(savedProperty),
      () => this.fallback.saveProperty(savedProperty)
    );
  }
  unsaveProperty(userId: string, propertyId: string) {
    return this.withFallback(
      "unsaveProperty",
      () => this.primary.unsaveProperty(userId, propertyId),
      () => this.fallback.unsaveProperty(userId, propertyId)
    );
  }

  // Property dislike methods
  dislikeProperty(dislike: InsertPropertyDislike) {
    return this.withFallback(
      "dislikeProperty",
      () => this.primary.dislikeProperty(dislike),
      () => this.fallback.dislikeProperty(dislike)
    );
  }
  getDislikedPropertyIds(userId: string) {
    return this.withFallback(
      "getDislikedPropertyIds",
      () => this.primary.getDislikedPropertyIds(userId),
      () => this.fallback.getDislikedPropertyIds(userId)
    );
  }

  // Property view methods
  getPropertyView(userId: string, propertyId: string) {
    return this.withFallback(
      "getPropertyView",
      () => this.primary.getPropertyView(userId, propertyId),
      () => this.fallback.getPropertyView(userId, propertyId)
    );
  }
  recordPropertyView(view: InsertPropertyView) {
    return this.withFallback(
      "recordPropertyView",
      () => this.primary.recordPropertyView(view),
      () => this.fallback.recordPropertyView(view)
    );
  }

  // Saved filter methods
  getSavedFiltersByUser(userId: string) {
    return this.withFallback(
      "getSavedFiltersByUser",
      () => this.primary.getSavedFiltersByUser(userId),
      () => this.fallback.getSavedFiltersByUser(userId)
    );
  }
  createSavedFilter(filter: InsertSavedFilter) {
    return this.withFallback(
      "createSavedFilter",
      () => this.primary.createSavedFilter(filter),
      () => this.fallback.createSavedFilter(filter)
    );
  }
  deleteSavedFilter(id: string, userId: string) {
    return this.withFallback(
      "deleteSavedFilter",
      () => this.primary.deleteSavedFilter(id, userId),
      () => this.fallback.deleteSavedFilter(id, userId)
    );
  }

  // Dismissed areas
  getDismissedAreasByUser(userId: string) {
    return this.withFallback(
      "getDismissedAreasByUser",
      () => this.primary.getDismissedAreasByUser(userId),
      () => this.fallback.getDismissedAreasByUser(userId)
    );
  }
  addDismissedArea(area: InsertDismissedArea) {
    return this.withFallback(
      "addDismissedArea",
      () => this.primary.addDismissedArea(area),
      () => this.fallback.addDismissedArea(area)
    );
  }

  // Reports & audit logs
  createPropertyReport(report: InsertPropertyReport) {
    return this.withFallback(
      "createPropertyReport",
      () => this.primary.createPropertyReport(report),
      () => this.fallback.createPropertyReport(report)
    );
  }
  getPropertyReports() {
    return this.withFallback(
      "getPropertyReports",
      () => this.primary.getPropertyReports(),
      () => this.fallback.getPropertyReports()
    );
  }
  createPropertyAuditLog(log: InsertPropertyAuditLog) {
    if (HAS_DATABASE_URL) {
      return this.primary.createPropertyAuditLog(log);
    }
    return this.withFallback(
      "createPropertyAuditLog",
      () => this.primary.createPropertyAuditLog(log),
      () => this.fallback.createPropertyAuditLog(log)
    );
  }
  getPropertyAuditLogs(propertyId: string) {
    return this.withFallback(
      "getPropertyAuditLogs",
      () => this.primary.getPropertyAuditLogs(propertyId),
      () => this.fallback.getPropertyAuditLogs(propertyId)
    );
  }

  // Watch events
  recordPropertyWatchEvent(event: InsertPropertyWatchEvent) {
    return this.withFallback(
      "recordPropertyWatchEvent",
      () => this.primary.recordPropertyWatchEvent(event),
      () => this.fallback.recordPropertyWatchEvent(event)
    );
  }
  getPropertyWatchEvents(propertyId: string) {
    return this.withFallback(
      "getPropertyWatchEvents",
      () => this.primary.getPropertyWatchEvents(propertyId),
      () => this.fallback.getPropertyWatchEvents(propertyId)
    );
  }

  // Lead methods
  getAllLeads() {
    return this.withFallback(
      "getAllLeads",
      () => this.primary.getAllLeads(),
      () => this.fallback.getAllLeads()
    );
  }
  createLead(lead: InsertLead) {
    return this.withFallback(
      "createLead",
      () => this.primary.createLead(lead),
      () => this.fallback.createLead(lead)
    );
  }
  updateLeadStatus(id: string, status: string) {
    return this.withFallback(
      "updateLeadStatus",
      () => this.primary.updateLeadStatus(id, status),
      () => this.fallback.updateLeadStatus(id, status)
    );
  }
}

// Prefer database storage when configured; in dev we can fall back to in-memory if the DB is unreachable.
const primaryStorage: IStorage = HAS_DATABASE_URL ? new DbStorage() : new MemStorage();
const fallbackStorage: IStorage = new MemStorage();
export const storage: IStorage =
  HAS_DATABASE_URL && ALLOW_FALLBACK ? new HybridStorage(primaryStorage, fallbackStorage) : primaryStorage;

// Log which storage is being used
if (HAS_DATABASE_URL) {
  console.log("[Storage] Using DATABASE storage (PostgreSQL)");
  console.log("[Storage] DATABASE_URL is configured");
} else {
  console.log("[Storage] Using IN-MEMORY storage (data will be lost on restart)");
  console.log("[Storage] To use database, set DATABASE_URL environment variable");
}
