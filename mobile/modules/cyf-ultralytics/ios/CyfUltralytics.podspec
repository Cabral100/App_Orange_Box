Pod::Spec.new do |s|
  s.name           = 'CyfUltralytics'
  s.version        = '1.0.0'
  s.summary        = 'Ponte nativa entre a câmera CYF e o UltralyticsYOLO.'
  s.description    = 'Expo Module local que executa o modelo Core ML treinado na câmera iOS.'
  s.author         = 'CYF'
  s.homepage       = 'https://github.com/Cabral100/App_Orange_Box'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/Cabral100/App_Orange_Box.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'UltralyticsYOLO', '~> 8.9'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.swift_version = '5.10'
end
