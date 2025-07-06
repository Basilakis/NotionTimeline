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
        console.log(`[getNotionDatabases] Scanning page ${pageId} for databases...`);
        let hasMore = true;
        let startCursor: string | undefined = undefined;

        while (hasMore) {
            const response = await notion.blocks.children.list({
                block_id: pageId,
                start_cursor: startCursor,
            });

            console.log(`[getNotionDatabases] Found ${response.results.length} blocks, checking for databases...`);

            for (const block of response.results) {
                console.log(`[getNotionDatabases] Block type: ${('type' in block) ? block.type : 'unknown'}`);
                if ('type' in block && block.type === "child_database") {
                    const databaseId = block.id;
                    console.log(`[getNotionDatabases] Found database ${databaseId}`);

                    try {
                        const databaseInfo = await notion.databases.retrieve({
                            database_id: databaseId,
                        });

                        console.log(`[getNotionDatabases] Successfully retrieved database: ${databaseInfo.title?.[0]?.plain_text || 'Untitled'}`);
                        childDatabases.push(databaseInfo);
                    } catch (error) {
                        console.error(`Error retrieving database ${databaseId}:`, error);
                    }
                }
            }

            hasMore = response.has_more;
            startCursor = response.next_cursor || undefined;
        }

        console.log(`[getNotionDatabases] Completed scan, found ${childDatabases.length} total databases`);
        return childDatabases;
    } catch (error) {
        console.error("Error listing child databases:", error);
        throw error;
    }
}

// Find a Notion database with the matching title
export async function findDatabaseByTitle(notion: Client, pageId: string, title: string) {
    const databases = await getNotionDatabases(notion, pageId);

    for (const db of databases) {
        if ('title' in db && db.title && Array.isArray(db.title) && db.title.length > 0) {
            const dbTitle = db.title[0]?.plain_text?.toLowerCase() || "";
            if (dbTitle === title.toLowerCase()) {
                return db;
            }
        }
    }

    return null;
}

// Create a new database if one with a matching title does not exist
export async function createDatabaseIfNotExists(notion: Client, pageId: string, title: string, properties: any) {
    const existingDb = await findDatabaseByTitle(notion, pageId, title);
    if (existingDb) {
        return existingDb;
    }
    return await notion.databases.create({
        parent: {
            type: "page_id",
            page_id: pageId
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


// Get filtered database records by user email
export async function getFilteredDatabaseRecords(notion: Client, databaseId: string, userEmail: string) {
    try {
        console.log(`[getFilteredDatabaseRecords] Checking database ${databaseId} for user ${userEmail}`);
        
        // Get all records without filtering first
        const response = await notion.databases.query({
            database_id: databaseId
        });

        console.log(`[getFilteredDatabaseRecords] Total records in database: ${response.results.length}`);
        
        // Filter records by checking both User Email field and People field
        const filteredResults = response.results.filter((page: any) => {
            const properties = page.properties;
            
            // Check if user email is in the User Email field
            const emailInField = properties.UserEmail?.email === userEmail || 
                                 properties["User Email"]?.email === userEmail;
            
            // Check if user email is in the People field
            const people = properties.People?.people || [];
            const emailInPeople = people.some((person: any) => 
                person.person?.email === userEmail
            );
            
            const projectName = properties?.["Project name"]?.title?.[0]?.plain_text || "Untitled";
            console.log(`[getFilteredDatabaseRecords] Project "${projectName}": emailInField=${emailInField}, emailInPeople=${emailInPeople}`);
            
            return emailInField || emailInPeople;
        });

        console.log(`[getFilteredDatabaseRecords] Found ${filteredResults.length} records for user ${userEmail}`);
        
        // Map to our record format
        const results = filteredResults.map((page: any) => {
            const properties = page.properties;
            
            return {
                notionId: page.id,
                title: properties.Title?.title?.[0]?.plain_text || 
                       properties.Name?.title?.[0]?.plain_text || 
                       properties["Project name"]?.title?.[0]?.plain_text ||
                       "Untitled",
                userEmail: properties.UserEmail?.email || properties["User Email"]?.email || null,
                createdTime: page.created_time,
                lastEditedTime: page.last_edited_time,
                url: page.url,
                properties: properties
            };
        });
        
        return results;
    } catch (error) {
        console.error(`Error querying database ${databaseId}:`, error);
        return [];
    }
}

// Get all tasks from a Notion database filtered by user email
export async function getProjectHierarchy(notion: Client, pageId: string) {
  const subPages = [];
  const uniqueUsers = new Set();
  let totalDatabases = 0;
  let totalRecords = 0;

  try {
    // Get all child pages of the main project
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const block of response.results) {
        if ('type' in block && block.type === "child_page") {
          // Get the child page details
          try {
            const page = await notion.pages.retrieve({
              page_id: block.id,
            });

            if ('properties' in page && page.properties) {
              // Extract page information
              const pageTitle = extractTextFromProperty(page.properties);
              const userEmail = extractEmailFromProperty(page.properties);
              
              if (userEmail) {
                uniqueUsers.add(userEmail);
              }

              // Get databases within this sub-page
              const pageDatabases = await getNotionDatabases(notion, block.id);
              
              let pageRecordCount = 0;
              const databases = [];

              for (const db of pageDatabases) {
                try {
                  // Get record count for each database
                  const dbResponse = await notion.databases.query({
                    database_id: db.id,
                    page_size: 1,
                  });
                  
                  const recordCount = dbResponse.results.length;
                  pageRecordCount += recordCount;
                  totalRecords += recordCount;

                  databases.push({
                    id: db.id,
                    title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
                      ? db.title[0]?.plain_text 
                      : 'Untitled Database',
                    recordCount,
                    url: `https://notion.so/${db.id.replace(/-/g, '')}`
                  });
                } catch (dbError) {
                  console.error(`Error querying database ${db.id}:`, dbError);
                }
              }

              totalDatabases += pageDatabases.length;

              subPages.push({
                id: block.id,
                title: pageTitle || "Untitled Page",
                userEmail: userEmail || null,
                databaseCount: pageDatabases.length,
                recordCount: pageRecordCount,
                databases,
                url: `https://notion.so/${block.id.replace(/-/g, '')}`,
                lastUpdated: 'last_edited_time' in page ? page.last_edited_time : new Date().toISOString()
              });
            }
          } catch (pageError) {
            console.error(`Error retrieving page ${block.id}:`, pageError);
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    // Also check for databases directly in the main page
    const mainPageDatabases = await getNotionDatabases(notion, pageId);
    totalDatabases += mainPageDatabases.length;

    return {
      subPages,
      uniqueUsers: Array.from(uniqueUsers),
      totalDatabases,
      totalRecords,
      mainPageDatabases: mainPageDatabases.length
    };
  } catch (error) {
    console.error("Error getting project hierarchy:", error);
    return {
      subPages: [],
      uniqueUsers: [],
      totalDatabases: 0,
      totalRecords: 0,
      mainPageDatabases: 0
    };
  }
}

// Helper function to extract text from Notion properties
function extractTextFromProperty(properties: any): string {
  // Look for title property
  for (const [key, prop] of Object.entries(properties)) {
    if ((prop as any).type === 'title' && (prop as any).title) {
      return (prop as any).title[0]?.plain_text || '';
    }
  }
  return '';
}

// Helper function to extract email from Notion properties
function extractEmailFromProperty(properties: any): string | null {
  // Look for email-related properties
  const emailKeys = ['User Email', 'UserEmail', 'Email', 'user_email', 'email'];
  
  for (const key of emailKeys) {
    const prop = properties[key];
    if (prop) {
      if (prop.type === 'email' && prop.email) {
        return prop.email;
      }
      if (prop.type === 'rich_text' && prop.rich_text?.[0]?.plain_text) {
        return prop.rich_text[0].plain_text;
      }
      if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
        return prop.title[0].plain_text;
      }
    }
  }
  return null;
}

// Discover workspace pages and databases for a specific user
export async function discoverWorkspacePages(notion: Client, pageId: string, userEmail: string) {
  const userPages = [];
  const userDatabases = [];
  const allDatabases = [];

  try {
    console.log(`[Discovery] Starting discovery for user: ${userEmail} in page: ${pageId}`);
    
    // First, check databases directly in the main page
    console.log(`[Discovery] Checking main page databases...`);
    const mainPageDatabases = await getNotionDatabases(notion, pageId);
    console.log(`[Discovery] Found ${mainPageDatabases.length} databases in main page`);
    
    for (const db of mainPageDatabases) {
      allDatabases.push({
        id: db.id,
        title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
          ? db.title[0]?.plain_text 
          : 'Untitled Database',
        parentPageId: pageId,
        parentPageTitle: "Main Workspace"
      });

      // Check if this database has records for the user
      try {
        const userRecords = await getFilteredDatabaseRecords(notion, db.id, userEmail);
        if (userRecords.length > 0) {
          userDatabases.push({
            id: db.id,
            title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
              ? db.title[0]?.plain_text 
              : 'Untitled Database',
            parentPageId: pageId,
            parentPageTitle: "Main Workspace",
            recordCount: userRecords.length
          });
        }
      } catch (dbError) {
        console.error(`Error checking database ${db.id} for user:`, dbError);
      }
    }

    // Now scan for child pages
    console.log(`[Discovery] Scanning for child pages...`);
    let hasMore = true;
    let startCursor: string | undefined = undefined;
    let totalChildPages = 0;

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
        page_size: 100,
      });

      console.log(`[Discovery] Found ${response.results.length} blocks in this batch`);

      for (const block of response.results) {
        if ('type' in block && block.type === "child_page") {
          totalChildPages++;
          console.log(`[Discovery] Processing child page ${totalChildPages}: ${block.id}`);
          try {
            const page = await notion.pages.retrieve({
              page_id: block.id,
            });

            if ('properties' in page && page.properties) {
              const pageTitle = extractTextFromProperty(page.properties);
              const pageUserEmail = extractEmailFromProperty(page.properties);
              
              // Check if this page belongs to the user or has the user's email
              if (pageUserEmail === userEmail) {
                userPages.push({
                  id: block.id,
                  title: pageTitle || "Untitled Page",
                  userEmail: pageUserEmail,
                  url: `https://notion.so/${block.id.replace(/-/g, '')}`
                });
              }

              // Check databases within this page regardless of ownership
              const pageDatabases = await getNotionDatabases(notion, block.id);
              
              for (const db of pageDatabases) {
                allDatabases.push({
                  id: db.id,
                  title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
                    ? db.title[0]?.plain_text 
                    : 'Untitled Database',
                  parentPageId: block.id,
                  parentPageTitle: pageTitle || "Untitled Page"
                });

                // Check if this database has records for the user
                try {
                  const userRecords = await getFilteredDatabaseRecords(notion, db.id, userEmail);
                  if (userRecords.length > 0) {
                    userDatabases.push({
                      id: db.id,
                      title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
                        ? db.title[0]?.plain_text 
                        : 'Untitled Database',
                      parentPageId: block.id,
                      parentPageTitle: pageTitle || "Untitled Page",
                      recordCount: userRecords.length
                    });
                  }
                } catch (dbError) {
                  console.error(`Error checking database ${db.id} for user:`, dbError);
                }
              }
            }
          } catch (pageError) {
            console.error(`Error retrieving page ${block.id}:`, pageError);
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    return {
      userPages,
      userDatabases,
      databases: allDatabases,
      totalFound: userPages.length + userDatabases.length
    };
  } catch (error) {
    console.error("Error discovering workspace pages:", error);
    return {
      userPages: [],
      userDatabases: [],
      databases: [],
      totalFound: 0
    };
  }
}

export async function getTasks(notion: Client, tasksDatabaseId: string, userEmail?: string) {
    try {
        let query: any = {
            database_id: tasksDatabaseId,
        };

        if (userEmail) {
            query.filter = {
                property: "User Email",
                email: {
                    equals: userEmail
                }
            };
        }

        const response = await notion.databases.query(query);

        return response.results.map((page: any) => {
            const properties = page.properties;

            const dueDate = properties.DueDate?.date?.start
                ? new Date(properties.DueDate.date.start)
                : null;

            const completedAt = properties.CompletedAt?.date?.start
                ? new Date(properties.CompletedAt.date.start)
                : null;

            // Enhanced status handling with colors and groups
            let mainStatus = null;
            let subStatus = null;
            let statusDisplay = null;
            let statusColor = null;
            let statusGroup = null;
            
            if (properties.Status) {
                // Check for status property (newer format with groups and colors)
                if (properties.Status.status) {
                    statusDisplay = properties.Status.status.name;
                    statusColor = properties.Status.status.color;
                    
                    // Map status to three main categories based on Notion's structure
                    const statusName = properties.Status.status.name.toLowerCase();
                    
                    if (statusName.includes('todo') || statusName.includes('to-do') || statusName.includes('backlog') || statusName.includes('planning')) {
                        mainStatus = 'To-do';
                        subStatus = properties.Status.status.name;
                        statusGroup = 'todo-status-group';
                    } else if (statusName.includes('progress') || statusName.includes('working') || statusName.includes('development') || statusName.includes('review') || statusName.includes('testing')) {
                        mainStatus = 'In Progress';
                        subStatus = properties.Status.status.name;
                        statusGroup = 'in-progress-status-group';
                    } else if (statusName.includes('done') || statusName.includes('completed') || statusName.includes('finished') || statusName.includes('deployed') || statusName.includes('closed')) {
                        mainStatus = 'Completed';
                        subStatus = properties.Status.status.name;
                        statusGroup = 'completed-status-group';
                    } else {
                        // Default to To-do for unknown statuses
                        mainStatus = 'To-do';
                        subStatus = properties.Status.status.name;
                        statusGroup = 'todo-status-group';
                    }
                }
                // Check for select property (older format)
                else if (properties.Status.select) {
                    statusDisplay = properties.Status.select.name;
                    statusColor = properties.Status.select.color;
                    
                    // Try to parse main status and sub-status
                    if (statusDisplay && statusDisplay.includes(' - ')) {
                        const parts = statusDisplay.split(' - ');
                        mainStatus = parts[0].trim();
                        subStatus = parts[1].trim();
                    } else {
                        mainStatus = statusDisplay;
                    }
                }
            }
            
            // Check for separate sub-status property
            if (properties.SubStatus || properties['Sub Status'] || properties['Sub-Status']) {
                const subStatusProp = properties.SubStatus || properties['Sub Status'] || properties['Sub-Status'];
                if (subStatusProp.select?.name) {
                    subStatus = subStatusProp.select.name;
                    if (subStatusProp.select.color) {
                        statusColor = subStatusProp.select.color;
                    }
                }
            }



            return {
                notionId: page.id,
                title: properties.Title?.title?.[0]?.plain_text || "Untitled Task",
                description: properties.Description?.rich_text?.[0]?.plain_text || "",
                section: properties.Section?.select?.name || "Uncategorized",
                isCompleted: properties.Completed?.checkbox || false,
                dueDate,
                completedAt,
                priority: properties.Priority?.select?.name || null,
                status: statusDisplay || "Not Started",
                mainStatus: mainStatus || "Not Started",
                subStatus: subStatus,
                statusColor: statusColor || "default",
                statusGroup: statusGroup,
                userEmail: properties.UserEmail?.email || properties["User Email"]?.email || null,
                assignee: properties.Assignee?.people?.[0]?.name || null,
            };
        });
    } catch (error) {
        console.error("Error fetching tasks from Notion:", error);
        throw new Error("Failed to fetch tasks from Notion");
    }
}