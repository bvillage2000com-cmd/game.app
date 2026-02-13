const Database = require('better-sqlite3');
const db = new Database('db.sqlite');

try {
    const result = db.prepare("UPDATE tenants SET powered_by = ? WHERE powered_by = ?").run("BUKIKORE KIKAKU", "123456");
    console.log(`Updated ${result.changes} rows matching '123456'`);

    // Also list current tenants to verify
    const tenants = db.prepare("SELECT * FROM tenants").all();
    console.log(tenants);

} catch (err) {
    console.error("Error updating database:", err);
}
