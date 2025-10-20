export function bindClassificationRepeaterOnce() {
   if (_classificationRepeaterBound) {return true};
   
   try {
    // Get a reference to the classification repeater
    
    // Check if the repeater exists
    if (!classifyRepeater) {
      console.error("Classification repeater not found");
      return false;
    }
    
    // Bind the item ready handler
    classifyRepeater.onItemReady(($item, itemData, index) => {
      // Classification message text
      $item("#classMsg").text = itemData.message;

      // icon: based on category
      const icon = itemData.icon || 
        (itemData.category === 1 ? "✅" :  // Callable
         itemData.category === 2 ? "🔷" :  // Wix
         itemData.category === 3 ? "📁" :  // Local
         itemData.category === 4 ? "⚠️" :  // Empty
         itemData.category === 5 ? "❌" : "❓"); // Not Callable
      $item("#classIcon").text = icon;

      // color by category
      const color =
        itemData.category === 1 ? "#2E7D32" :  // Green for callable
        itemData.category === 2 ? "#2196F3" :  // Blue for Wix
        itemData.category === 3 ? "#FF8F00" :  // Orange for local
        itemData.category === 4 ? "#FFC107" :  // Yellow for empty
        itemData.category === 5 ? "#C62828" : "#0F2B42"; // Red for not callable
      $item("#classMsg").style.color = color;
    });

    _classificationRepeaterBound = true;
    console.log("Classification repeater bound successfully");
    return true;
  } catch (err) {
    console.error("Failed to bind classification repeater:", err);
    _classificationRepeaterBound = false;
    return false;
  }
}