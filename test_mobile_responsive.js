// Test script for mobile responsive functionality
// Run this in the browser console on mobile viewport

// Test mobile elements positioning and visibility
function testMobileElements() {
  console.log('🔍 Testing mobile elements positioning...');
  
  // Check mobile search bar
  const mobileSearchBar = document.querySelector('[data-testid="mobile-search-bar"]');
  if (mobileSearchBar) {
    const rect = mobileSearchBar.getBoundingClientRect();
    console.log('✅ Mobile search bar found');
    console.log('   Position:', { top: rect.top, left: rect.left, right: rect.right });
    console.log('   Classes:', mobileSearchBar.className);
  } else {
    console.log('❌ Mobile search bar not found');
  }
  
  // Check mobile quick filters
  const mobileQuickFilters = document.querySelector('[data-testid="mobile-quick-filters"]');
  if (mobileQuickFilters) {
    const rect = mobileQuickFilters.getBoundingClientRect();
    console.log('✅ Mobile quick filters found');
    console.log('   Position:', { top: rect.top, left: rect.left, right: rect.right });
    console.log('   Classes:', mobileQuickFilters.className);
  } else {
    console.log('❌ Mobile quick filters not found');
  }
  
  // Check mobile filter button
  const mobileFilterButton = document.querySelector('[data-testid="mobile-filter-button"]');
  if (mobileFilterButton) {
    console.log('✅ Mobile filter button found');
    console.log('   Classes:', mobileFilterButton.className);
  } else {
    console.log('❌ Mobile filter button not found');
  }
}

// Test navbar visibility transitions
function testNavbarVisibility() {
  console.log('🔍 Testing navbar visibility...');
  
  const navbar = document.querySelector('nav');
  if (navbar) {
    const classes = navbar.className;
    console.log('✅ Navbar found');
    console.log('   Classes:', classes);
    console.log('   Has transition classes:', classes.includes('transition-all'));
  } else {
    console.log('❌ Navbar not found');
  }
}

// Test filter overlay scrollability
function testFilterOverlay() {
  console.log('🔍 Testing filter overlay...');
  
  const filterOverlay = document.querySelector('[data-testid="mobile-filter-overlay"]');
  if (filterOverlay) {
    console.log('✅ Filter overlay found');
    console.log('   Classes:', filterOverlay.className);
    
    // Check if it has flexbox layout
    const hasFlexbox = filterOverlay.className.includes('flex flex-col');
    console.log('   Has flexbox layout:', hasFlexbox);
    
    // Check for scrollable content area
    const scrollableContent = filterOverlay.querySelector('.flex-1.overflow-y-auto');
    if (scrollableContent) {
      console.log('✅ Scrollable content area found');
      console.log('   Classes:', scrollableContent.className);
    } else {
      console.log('❌ Scrollable content area not found');
    }
  } else {
    console.log('❌ Filter overlay not found');
  }
}

// Test viewport positioning
function testViewportPositioning() {
  console.log('🔍 Testing viewport positioning...');
  
  const mobileSearchBar = document.querySelector('[data-testid="mobile-search-bar"]');
  const mobileQuickFilters = document.querySelector('[data-testid="mobile-quick-filters"]');
  
  if (mobileSearchBar && mobileQuickFilters) {
    const searchBarRect = mobileSearchBar.getBoundingClientRect();
    const quickFiltersRect = mobileQuickFilters.getBoundingClientRect();
    
    console.log('✅ Both elements found');
    console.log('   Search bar top:', searchBarRect.top);
    console.log('   Quick filters top:', quickFiltersRect.top);
    console.log('   Search bar height:', searchBarRect.height);
    console.log('   Quick filters height:', quickFiltersRect.height);
    
    // Check if search bar is at top of viewport
    const searchBarAtTop = Math.abs(searchBarRect.top) < 5;
    console.log('   Search bar at top of viewport:', searchBarAtTop);
    
    // Check if quick filters are positioned correctly
    const quickFiltersPositioned = quickFiltersRect.top > searchBarRect.bottom - 5;
    console.log('   Quick filters positioned below search bar:', quickFiltersPositioned);
    
    // Check for overlap
    const hasOverlap = !(searchBarRect.bottom <= quickFiltersRect.top || quickFiltersRect.bottom <= searchBarRect.top);
    console.log('   Elements overlap:', hasOverlap);
  } else {
    console.log('❌ Required elements not found');
  }
}

// Test for duplicate search bars
function testNoDuplicateSearchBars() {
  console.log('🔍 Testing for duplicate search bars...');
  
  // Check for dive sites page
  const diveSitesPage = window.location.pathname.includes('/dive-sites');
  const divingCentersPage = window.location.pathname.includes('/diving-centers');
  
  if (diveSitesPage) {
    const mobileSearchBar = document.querySelector('[data-testid="mobile-search-bar"]');
    const desktopSearchBar = document.querySelector('[data-testid="desktop-search-bar"]');
    
    console.log('✅ Testing dive sites page');
    console.log('   Mobile search bar found:', !!mobileSearchBar);
    console.log('   Desktop search bar found:', !!desktopSearchBar);
    
    // On mobile, only mobile search bar should be visible
    if (window.innerWidth <= 768) {
      if (mobileSearchBar && !desktopSearchBar) {
        console.log('✅ Correct: Only mobile search bar visible on mobile');
      } else if (mobileSearchBar && desktopSearchBar) {
        console.log('❌ Issue: Both search bars visible on mobile');
      } else {
        console.log('❌ Issue: Missing search bars on mobile');
      }
    } else {
      if (!mobileSearchBar && desktopSearchBar) {
        console.log('✅ Correct: Only desktop search bar visible on desktop');
      } else {
        console.log('❌ Issue: Incorrect search bar visibility on desktop');
      }
    }
  } else if (divingCentersPage) {
    const mobileSearchBar = document.querySelector('[data-testid="diving-centers-mobile-search-bar"]');
    const desktopSearchBar = document.querySelector('[data-testid="diving-centers-desktop-search-bar"]');
    
    console.log('✅ Testing diving centers page');
    console.log('   Mobile search bar found:', !!mobileSearchBar);
    console.log('   Desktop search bar found:', !!desktopSearchBar);
    
    // On mobile, only mobile search bar should be visible
    if (window.innerWidth <= 768) {
      if (mobileSearchBar && !desktopSearchBar) {
        console.log('✅ Correct: Only mobile search bar visible on mobile');
      } else if (mobileSearchBar && desktopSearchBar) {
        console.log('❌ Issue: Both search bars visible on mobile');
      } else {
        console.log('❌ Issue: Missing search bars on mobile');
      }
    } else {
      if (!mobileSearchBar && desktopSearchBar) {
        console.log('✅ Correct: Only desktop search bar visible on desktop');
      } else {
        console.log('❌ Issue: Incorrect search bar visibility on desktop');
      }
    }
  } else {
    console.log('ℹ️ Not on dive sites or diving centers page');
  }
}

// Test diving centers responsive functionality
function testDivingCentersResponsive() {
  console.log('🔍 Testing diving centers responsive functionality...');
  
  const responsiveFilterBar = document.querySelector('[data-testid="diving-centers-responsive-filter-bar"]');
  const mobileQuickFilters = document.querySelector('[data-testid="diving-centers-mobile-quick-filters"]');
  const mobileFilterOverlay = document.querySelector('[data-testid="diving-centers-mobile-filter-overlay"]');
  const mobileFilterButton = document.querySelector('[data-testid="diving-centers-mobile-filter-button"]');
  
  console.log('✅ Responsive filter bar found:', !!responsiveFilterBar);
  console.log('✅ Mobile quick filters found:', !!mobileQuickFilters);
  console.log('✅ Mobile filter overlay found:', !!mobileFilterOverlay);
  console.log('✅ Mobile filter button found:', !!mobileFilterButton);
}

// Test new sorting functionality in filter overlay
function testSortingFunctionality() {
  console.log('🔍 Testing sorting functionality in filter overlay...');
  
  // Check if we're on a page with sorting functionality
  const diveSitesPage = window.location.pathname.includes('/dive-sites');
  const divingCentersPage = window.location.pathname.includes('/diving-centers');
  
  if (!diveSitesPage && !divingCentersPage) {
    console.log('ℹ️ Not on a page with sorting functionality');
    return;
  }
  
  // Test filter overlay tabs
  const filterOverlay = document.querySelector('[data-testid="mobile-filter-overlay"], [data-testid="diving-centers-mobile-filter-overlay"]');
  if (filterOverlay) {
    console.log('✅ Filter overlay found');
    
    // Check for tab navigation
    const tabNavigation = filterOverlay.querySelector('.flex.border-b.border-gray-200');
    if (tabNavigation) {
      console.log('✅ Tab navigation found');
      
      // Check for Filters tab
      const filtersTab = tabNavigation.querySelector('button:contains("Filters")');
      console.log('   Filters tab found:', !!filtersTab);
      
      // Check for Sorting & View tab
      const sortingTab = tabNavigation.querySelector('button:contains("Sorting & View")');
      console.log('   Sorting & View tab found:', !!sortingTab);
      
      // Check tab styling
      const activeTab = tabNavigation.querySelector('.text-blue-600.border-b-2.border-blue-600.bg-blue-50');
      if (activeTab) {
        console.log('✅ Active tab styling found');
        console.log('   Active tab text:', activeTab.textContent.trim());
      } else {
        console.log('❌ Active tab styling not found');
      }
    } else {
      console.log('❌ Tab navigation not found');
    }
    
    // Check for sorting controls (when sorting tab is active)
    const sortingTab = filterOverlay.querySelector('button:contains("Sorting & View")');
    if (sortingTab) {
      // Click on sorting tab to activate it
      sortingTab.click();
      
      // Wait a bit for the content to update
      setTimeout(() => {
        console.log('🔍 Testing sorting tab content...');
        
        // Check for sort field selection
        const sortFieldSection = filterOverlay.querySelector('h4:contains("Sort Field")');
        console.log('   Sort field section found:', !!sortFieldSection);
        
        // Check for sort order section
        const sortOrderSection = filterOverlay.querySelector('h4:contains("Sort Order")');
        console.log('   Sort order section found:', !!sortOrderSection);
        
        // Check for view mode section
        const viewModeSection = filterOverlay.querySelector('h4:contains("View Mode")');
        console.log('   View mode section found:', !!viewModeSection);
        
        // Check for display options section
        const displayOptionsSection = filterOverlay.querySelector('h4:contains("Display Options")');
        console.log('   Display options section found:', !!displayOptionsSection);
        
        // Check for sorting action buttons
        const applySortButton = filterOverlay.querySelector('button:contains("Apply Sort")');
        const resetButton = filterOverlay.querySelector('button:contains("Reset")');
        console.log('   Apply Sort button found:', !!applySortButton);
        console.log('   Reset button found:', !!resetButton);
        
        // Check for view mode options (should only have list and map, no grid)
        const listViewButton = filterOverlay.querySelector('button:contains("List View")');
        const mapViewButton = filterOverlay.querySelector('button:contains("Map View")');
        const gridViewButton = filterOverlay.querySelector('button:contains("Grid View")');
        
        console.log('   List view button found:', !!listViewButton);
        console.log('   Map view button found:', !!mapViewButton);
        console.log('   Grid view button found (should be false):', !!gridViewButton);
        
        if (!gridViewButton) {
          console.log('✅ Correct: Grid view removed for mobile');
        } else {
          console.log('❌ Issue: Grid view still present for mobile');
        }
        
      }, 100);
    }
  } else {
    console.log('❌ Filter overlay not found');
  }
}

// Test mobile responsive behavior
function testMobileResponsive() {
  console.log('🔍 Testing mobile responsive behavior...');
  
  const isMobile = window.innerWidth <= 768;
  console.log('   Viewport width:', window.innerWidth);
  console.log('   Is mobile:', isMobile);
  
  if (isMobile) {
    // Test scroll behavior
    console.log('   Testing scroll behavior...');
    
    // Check if navbar is initially visible
    const navbar = document.querySelector('nav');
    if (navbar) {
      const initialClasses = navbar.className;
      console.log('   Initial navbar classes:', initialClasses);
      
      // Check if navbar has transition classes
      const hasTransitions = initialClasses.includes('transition-all');
      console.log('   Navbar has transitions:', hasTransitions);
    }
    
    // Test filter overlay functionality
    const filterButton = document.querySelector('[data-testid="mobile-filter-button"], [data-testid="diving-centers-mobile-filter-button"]');
    if (filterButton) {
      console.log('   Filter button found, testing overlay...');
      
      // Check if overlay is initially closed
      const filterOverlay = document.querySelector('[data-testid="mobile-filter-overlay"], [data-testid="diving-centers-mobile-filter-overlay"]');
      const overlayInitiallyClosed = !filterOverlay || filterOverlay.style.display === 'none';
      console.log('   Overlay initially closed:', overlayInitiallyClosed);
    }
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running all mobile responsive tests...\n');
  
  testMobileElements();
  console.log('');
  
  testNavbarVisibility();
  console.log('');
  
  testFilterOverlay();
  console.log('');
  
  testViewportPositioning();
  console.log('');
  
  testNoDuplicateSearchBars();
  console.log('');
  
  testDivingCentersResponsive();
  console.log('');
  
  testSortingFunctionality();
  console.log('');
  
  testMobileResponsive();
  console.log('');
  
  console.log('✅ All tests completed!');
}

// Export functions for manual testing
window.testMobileResponsive = {
  testMobileElements,
  testNavbarVisibility,
  testFilterOverlay,
  testViewportPositioning,
  testNoDuplicateSearchBars,
  testDivingCentersResponsive,
  testSortingFunctionality,
  testMobileResponsive,
  runAllTests
};

console.log('📱 Mobile responsive test functions loaded!');
console.log('Run testMobileResponsive.runAllTests() to test everything');
console.log('Or run individual tests like testMobileResponsive.testSortingFunctionality()');
