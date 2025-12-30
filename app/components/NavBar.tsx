import { MaterialIcons } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const NavBar = () => {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  const isActive = (path: string) => {
    // Match both the full path and the simple tab name
    return pathname === path || pathname === path.replace('/(tabs)', '')
  }

  return (
    <View className='relative' style={{ paddingBottom: insets.bottom }}>
      {/* Main Navigation Bar */}
      <View 
        className='bg-white flex-row items-center justify-around h-16 shadow-lg border-t border-gray-200'
      >
        
        {/* Home Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/home')}
        >
          <MaterialIcons 
            name="home" 
            size={28} 
            color={isActive('/(tabs)/home') ? '#3b82f6' : '#4b5563'} 
          />
          <Text className={`text-xs mt-1 ${isActive('/(tabs)/home') ? 'text-blue-500 font-semibold' : 'text-gray-600'}`}>
            Home
          </Text>
        </TouchableOpacity>

        {/* History Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/history')}
        >
          <MaterialIcons 
            name="history" 
            size={28} 
            color={isActive('/(tabs)/history') ? '#3b82f6' : '#4b5563'} 
          />
          <Text className={`text-xs mt-1 ${isActive('/(tabs)/history') ? 'text-blue-500 font-semibold' : 'text-gray-600'}`}>
            History
          </Text>
        </TouchableOpacity>

        {/* Center Spacer for the floating button */}
        <View className='w-16' />

        {/* Stats Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/stats')}
        >
          <MaterialIcons 
            name="bar-chart" 
            size={28} 
            color={isActive('/(tabs)/stats') ? '#3b82f6' : '#4b5563'} 
          />
          <Text className={`text-xs mt-1 ${isActive('/(tabs)/stats') ? 'text-blue-500 font-semibold' : 'text-gray-600'}`}>
            Stats
          </Text>
        </TouchableOpacity>

        {/* Settings Icon */}
        <TouchableOpacity 
          className='items-center justify-center px-6 py-2'
          onPress={() => router.push('/(tabs)/settings')}
        >
          <MaterialIcons 
            name="settings" 
            size={28} 
            color={isActive('/(tabs)/settings') ? '#3b82f6' : '#4b5563'} 
          />
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
          <MaterialIcons name="add" size={32} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default NavBar