import { Client } from "@notionhq/client";
import { NotionAPI } from "notion-client";

// Create a Notion client for a specific user configuration
export function createNotionClient(secret: string): Client {
    return new Client({
        auth: secret,
    });
}

// Create NotionAPI client for react-notion-x integration
export function createNotionAPI(): NotionAPI {
    return new NotionAPI();
}

// Extract the page ID from the Notion page URL
export function extractPageIdFromUrl(pageUrl: string): string {
    const match = pageUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
    if (match && match[1]) {
        return match[1];
    }

    throw Error("Failed to extract page ID from URL");
}

/**
 * Lists all child databases contained within a Notion page
 * @param notion - Notion client instance
 * @param pageId - The page ID to search for databases
 * @returns {Promise<Array<{id: string, title: string}>>} - Array of database objects with id and title
 */
export async function getNotionDatabases(notion: Client, pageId: string) {
    const childDatabases = [];

    try {
        let hasMore = true;
        let startCursor: string | undefined = undefined;

        while (hasMore) {
            const response = await notion.blocks.children.list({
                block_id: pageId,
                start_cursor: startCursor,
            });

            for (const block of response.results) {
                if (block.type === "child_database") {
                    const databaseId = block.id;

                    try {
                        const databaseInfo = await notion.databases.retrieve({
                            database_id: databaseId,
                        });

                        childDatabases.push(databaseInfo);
                    } catch (error) {
                        console.error(`Error retrieving database ${databaseId}:`, error);
                    }
                }
            }

            hasMore = response.has_more;
            startCursor = response.next_cursor || undefined;
        }

        return childDatabases;
    } catch (error) {
        console.error("Error listing child databases:", error);
        throw error;
    }
}

// Find get a Notion database with the matching title
export async function findDatabaseByTitle(title: string) {
    const databases = await getNotionDatabases();

    for (const db of databases) {
        if (db.title && Array.isArray(db.title) && db.title.length > 0) {
            const dbTitle = db.title[0]?.plain_text?.toLowerCase() || "";
            if (dbTitle === title.toLowerCase()) {
                return db;
            }
        }
    }

    return null;
}

// Create a new database if one with a matching title does not exist
export async function createDatabaseIfNotExists(title, properties) {
    const existingDb = await findDatabaseByTitle(title);
    if (existingDb) {
        return existingDb;
    }
    return await notion.databases.create({
        parent: {
            type: "page_id",
            page_id: NOTION_PAGE_ID
        },
        title: [
            {
                type: "text",
                text: {
                    content: title
                }
            }
        ],
        properties
    });
}


// Example function to Get all tasks from the Notion database
export async function getTasks(tasksDatabaseId: string) {
    try {
        const response = await notion.databases.query({
            database_id: tasksDatabaseId,
        });

        return response.results.map((page: any) => {
            const properties = page.properties;

            const dueDate = properties.DueDate?.date?.start
                ? new Date(properties.DueDate.date.start)
                : null;

            const completedAt = properties.CompletedAt?.date?.start
                ? new Date(properties.CompletedAt.date.start)
                : null;

            return {
                notionId: page.id,
                title: properties.Title?.title?.[0]?.plain_text || "Untitled Task",
                description: properties.Description?.rich_text?.[0]?.plain_text || "",
                section: properties.Section?.select?.name || "Uncategorized",
                isCompleted: properties.Completed?.checkbox || false,
                dueDate,
                completedAt,
                priority: properties.Priority?.select?.name || null,
                status: properties.Status?.status?.name || null,
            };
        });
    } catch (error) {
        console.error("Error fetching tasks from Notion:", error);
        throw new Error("Failed to fetch tasks from Notion");
    }
}