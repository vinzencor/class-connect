export const STATE_CITY_MAP: Record<string, string[]> = {
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
  Delhi: ['New Delhi'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
};

export const STATE_OPTIONS = Object.keys(STATE_CITY_MAP);
