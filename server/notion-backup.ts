// This is a clean implementation of the getFilteredDatabaseRecords function
import { Client } from "@notionhq/client";

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