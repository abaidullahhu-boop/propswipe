import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  users,
  properties,
  savedProperties,
  propertyDislikes,
  propertyViews,
  leads,
  savedFilters,
  propertyReports,
  propertyAuditLogs,
  propertyWatchEvents,
  dismissedAreas,
  societies,
  societyBlocks,
  blockPlots,
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
} from "@shared/schema";
import type { IStorage } from "./storage";

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not configured");
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllProperties(): Promise<Property[]> {
    if (!db) return [];
    return db.select().from(properties).orderBy(desc(properties.createdAt));
  }

  async getSocieties(search?: string): Promise<Society[]> {
    if (!db) return [];
    const term = String(search ?? "").trim().toLowerCase();
    const rows = await db.select().from(societies).orderBy(desc(societies.createdAt));
    return term
      ? rows.filter((row) =>
          [row.name, row.city, row.state].some((value) => String(value).toLowerCase().includes(term))
        )
      : rows;
  }

  async createSociety(insertSociety: InsertSociety): Promise<Society> {
    if (!db) throw new Error("Database not configured");
    const resolvedId = (insertSociety as any).id ?? randomUUID();
    const [society] = await db
      .insert(societies)
      .values({
        ...insertSociety,
        id: resolvedId,
      })
      .returning();
    return society;
  }

  async getSocietyBlocks(societyId: string): Promise<SocietyBlock[]> {
    if (!db) return [];
    return db.select().from(societyBlocks).where(eq(societyBlocks.societyId, societyId));
  }

  async createSocietyBlock(insertBlock: InsertSocietyBlock): Promise<SocietyBlock> {
    if (!db) throw new Error("Database not configured");
    const resolvedId = (insertBlock as any).id ?? randomUUID();
    const [block] = await db
      .insert(societyBlocks)
      .values({
        ...insertBlock,
        id: resolvedId,
      })
      .returning();
    return block;
  }

  async getBlockPlots(blockId: string): Promise<BlockPlot[]> {
    if (!db) return [];
    return db.select().from(blockPlots).where(eq(blockPlots.blockId, blockId));
  }

  async createBlockPlot(insertPlot: InsertBlockPlot): Promise<BlockPlot> {
    if (!db) throw new Error("Database not configured");
    const resolvedId = (insertPlot as any).id ?? randomUUID();
    const [plot] = await db
      .insert(blockPlots)
      .values({
        ...insertPlot,
        id: resolvedId,
      })
      .returning();
    return plot;
  }

  async updateBlockPlot(
    plotId: string,
    updates: Partial<Pick<InsertBlockPlot, "plotNumber" | "x" | "y" | "size" | "status" | "metaJson">>
  ): Promise<BlockPlot> {
    if (!db) throw new Error("Database not configured");
    const [plot] = await db
      .update(blockPlots)
      .set(updates)
      .where(eq(blockPlots.id, plotId))
      .returning();

    if (!plot) {
      throw new Error("Plot not found");
    }
    return plot;
  }

  async getPlotById(plotId: string): Promise<{ plot: BlockPlot; block: SocietyBlock; society: Society } | undefined> {
    if (!db) return undefined;
    const [plot] = await db.select().from(blockPlots).where(eq(blockPlots.id, plotId));
    if (!plot) return undefined;
    const [block] = await db.select().from(societyBlocks).where(eq(societyBlocks.id, plot.blockId));
    if (!block) return undefined;
    const [society] = await db.select().from(societies).where(eq(societies.id, block.societyId));
    if (!society) return undefined;
    return { plot, block, society };
  }

  async getBlockDetails(blockId: string): Promise<{ block: SocietyBlock; plots: BlockPlot[] } | undefined> {
    if (!db) return undefined;
    const [block] = await db.select().from(societyBlocks).where(eq(societyBlocks.id, blockId));
    if (!block) return undefined;
    const plots = await db.select().from(blockPlots).where(eq(blockPlots.blockId, blockId));
    return { block, plots };
  }

  async searchPlots(
    query: string,
    societyId?: string
  ): Promise<Array<{ society: Society; block: SocietyBlock; plot: BlockPlot }>> {
    if (!db) return [];
    const term = String(query ?? "").trim().toLowerCase();
    if (!term) return [];
    const filteredSocieties = await this.getSocieties();
    const targetSocietyIds = societyId
      ? new Set([societyId])
      : new Set(filteredSocieties.map((s) => s.id));
    const results: Array<{ society: Society; block: SocietyBlock; plot: BlockPlot }> = [];
    for (const society of filteredSocieties) {
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
    if (!db) return undefined;
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));
    return property;
  }

  async getPropertyByPlotId(plotId: string): Promise<Property | undefined> {
    if (!db) return undefined;
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.plotId, plotId));
    return property;
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    if (!db) throw new Error("Database not configured");
    const [property] = await db
      .insert(properties)
      .values(insertProperty)
      .returning();
    return property;
  }

  async updateProperty(
    id: string,
    updates: Partial<InsertProperty>
  ): Promise<Property> {
    if (!db) throw new Error("Database not configured");
    const [property] = await db
      .update(properties)
      .set(updates)
      .where(eq(properties.id, id))
      .returning();
    if (!property) {
      throw new Error("Property not found");
    }
    return property;
  }

  async deleteProperty(id: string): Promise<void> {
    if (!db) return;
    await db.delete(properties).where(eq(properties.id, id));
  }

  async incrementPropertyViews(id: string): Promise<void> {
    if (!db) return;
    const property = await this.getProperty(id);
    if (property) {
      await db
        .update(properties)
        .set({ views: property.views + 1 })
        .where(eq(properties.id, id));
    }
  }

  async getAllSavedProperties(): Promise<SavedProperty[]> {
    if (!db) return [];
    return db.select().from(savedProperties);
  }

  async getSavedPropertiesByUser(userId: string): Promise<SavedProperty[]> {
    if (!db) {
      console.log('DB: Database not configured');
      return [];
    }
    console.log('DB: Querying saved properties for userId:', userId);
    const result = await db
      .select()
      .from(savedProperties)
      .where(eq(savedProperties.userId, userId));
    console.log('DB: Found saved properties:', result.length);
    return result;
  }

  async saveProperty(
    insertSavedProperty: InsertSavedProperty
  ): Promise<SavedProperty> {
    if (!db) throw new Error("Database not configured");
    const [savedProperty] = await db
      .insert(savedProperties)
      .values(insertSavedProperty)
      .returning();
    return savedProperty;
  }

  async unsaveProperty(userId: string, propertyId: string): Promise<void> {
    if (!db) return;
    await db
      .delete(savedProperties)
      .where(
        and(
          eq(savedProperties.userId, userId),
          eq(savedProperties.propertyId, propertyId)
        )
      );
  }

  async dislikeProperty(
    insertDislike: InsertPropertyDislike
  ): Promise<PropertyDislike> {
    if (!db) throw new Error("Database not configured");
    const [dislike] = await db
      .insert(propertyDislikes)
      .values(insertDislike)
      .returning();
    return dislike;
  }

  async getDislikedPropertyIds(userId: string): Promise<string[]> {
    if (!db) return [];
    const dislikes = await db
      .select()
      .from(propertyDislikes)
      .where(eq(propertyDislikes.userId, userId));
    return dislikes.map((d) => d.propertyId);
  }

  async getPropertyView(userId: string, propertyId: string): Promise<PropertyView | undefined> {
    if (!db) return undefined;
    const [view] = await db
      .select()
      .from(propertyViews)
      .where(
        and(
          eq(propertyViews.userId, userId),
          eq(propertyViews.propertyId, propertyId)
        )
      );
    return view;
  }

  async recordPropertyView(insertView: InsertPropertyView): Promise<PropertyView> {
    if (!db) throw new Error("Database not configured");
    const [view] = await db
      .insert(propertyViews)
      .values(insertView)
      .returning();
    return view;
  }

  async getSavedFiltersByUser(userId: string): Promise<SavedFilter[]> {
    if (!db) return [];
    return db.select().from(savedFilters).where(eq(savedFilters.userId, userId));
  }

  async createSavedFilter(insertFilter: InsertSavedFilter): Promise<SavedFilter> {
    if (!db) throw new Error("Database not configured");
    const [filter] = await db.insert(savedFilters).values(insertFilter).returning();
    return filter;
  }

  async deleteSavedFilter(id: string, userId: string): Promise<void> {
    if (!db) return;
    await db
      .delete(savedFilters)
      .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId)));
  }

  async getDismissedAreasByUser(userId: string): Promise<DismissedArea[]> {
    if (!db) return [];
    return db.select().from(dismissedAreas).where(eq(dismissedAreas.userId, userId));
  }

  async addDismissedArea(area: InsertDismissedArea): Promise<DismissedArea> {
    if (!db) throw new Error("Database not configured");
    const [created] = await db.insert(dismissedAreas).values(area).returning();
    return created;
  }

  async createPropertyReport(
    report: InsertPropertyReport
  ): Promise<PropertyReport> {
    if (!db) throw new Error("Database not configured");
    const [created] = await db.insert(propertyReports).values(report).returning();
    return created;
  }

  async getPropertyReports(): Promise<PropertyReport[]> {
    if (!db) return [];
    return db.select().from(propertyReports).orderBy(desc(propertyReports.createdAt));
  }

  async createPropertyAuditLog(
    log: InsertPropertyAuditLog
  ): Promise<PropertyAuditLog> {
    if (!db) throw new Error("Database not configured");
    const [created] = await db.insert(propertyAuditLogs).values(log).returning();
    return created;
  }

  async getPropertyAuditLogs(propertyId: string): Promise<PropertyAuditLog[]> {
    if (!db) return [];
    return db
      .select()
      .from(propertyAuditLogs)
      .where(eq(propertyAuditLogs.propertyId, propertyId))
      .orderBy(desc(propertyAuditLogs.createdAt));
  }

  async recordPropertyWatchEvent(
    event: InsertPropertyWatchEvent
  ): Promise<PropertyWatchEvent> {
    if (!db) throw new Error("Database not configured");
    const [created] = await db.insert(propertyWatchEvents).values(event).returning();
    return created;
  }

  async getPropertyWatchEvents(propertyId: string): Promise<PropertyWatchEvent[]> {
    if (!db) return [];
    return db
      .select()
      .from(propertyWatchEvents)
      .where(eq(propertyWatchEvents.propertyId, propertyId));
  }

  async getAllLeads(): Promise<Lead[]> {
    if (!db) return [];
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    if (!db) throw new Error("Database not configured");
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead> {
    if (!db) throw new Error("Database not configured");
    const [lead] = await db
      .update(leads)
      .set({ status })
      .where(eq(leads.id, id))
      .returning();
    if (!lead) {
      throw new Error("Lead not found");
    }
    return lead;
  }
}
