import { usePathname, useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

const NavBar = () => {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <View className='relative'>
      {/* Main Navigation Bar */}
      <View className='bg-white flex-row items-center justify-around h-16 shadow-lg border-t border-gray-200'>
        
        {/* Home Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/home')}
        >
          <Text className='text-2xl'>🏠</Text>
          <Text className={`text-xs mt-1 ${isActive('/(tabs)/home') ? 'text-blue-500 font-semibold' : 'text-gray-600'}`}>
            Home
          </Text>
        </TouchableOpacity>

        {/* Stats Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/stats')}
        >
          <Text className='text-2xl'>📊</Text>
          <Text className={`text-xs mt-1 ${isActive('/(tabs)/stats') ? 'text-blue-500 font-semibold' : 'text-gray-600'}`}>
            Stats
          </Text>
        </TouchableOpacity>

        {/* Center Spacer for the floating button */}
        <View className='w-16' />

        {/* Budget Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/budget')}
        >
          <Text className='text-2xl'>💰</Text>
          <Text className={`text-xs mt-1 ${isActive('/(tabs)/budget') ? 'text-blue-500 font-semibold' : 'text-gray-600'}`}>
            Budget
          </Text>
        </TouchableOpacity>

        {/* Settings Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/settings')}
        >
          <Text className='text-2xl'>⚙️</Text>
          <Text className={`text-xs mt-1 ${isActive('/(tabs)/settings') ? 'text-blue-500 font-semibold' : 'text-gray-600'}`}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floating Add Button */}
      <View className='absolute left-1/2 -top-6 -ml-7'>
        <TouchableOpacity 
          className='bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-xl'
          style={{
            shadowColor: '#3b82f6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
          onPress={() => router.push('/(tabs)/newTransaction')}
        >
          <Text className='text-white text-3xl font-bold'>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default NavBar